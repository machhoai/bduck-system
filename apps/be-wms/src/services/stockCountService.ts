import { randomUUID } from "crypto";
import {
  AuditAction,
  IssueType,
  NonconformitySourceType,
  NonconformityStatus,
  QuarantineStatus,
  StockCountItemCondition,
  StockCountPurpose,
  StockCountSessionStatus,
  StockCountSource,
  StockCountType,
  calculateInventoryTotalQuantity,
} from "@bduck/shared-types";
import type { Inventory, StockCountItem, StockCountSession } from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { findAll as findInventory } from "../repositories/inventoryRepository.js";
import { locationRepository } from "../repositories/locationRepository.js";
import { productRepository } from "../repositories/productRepository.js";
import { getUsersByIds } from "../repositories/userRepository.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";
import {
  findItemsBySessionId,
  findSessionById,
  findSessions,
  itemsCollection,
  sessionsCollection,
  type StockCountSessionFilters,
} from "../repositories/stockCountRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

type ServiceError = Error & { statusCode: number; messages: Record<string, string> };

export interface CreateExternalCountInput {
  warehouse_id: string;
  warehouse_location_id: string;
  count_purpose: StockCountPurpose;
  business_date: string;
  blind_count_enabled: boolean;
  external_operator_name?: string | null;
  external_operator_id?: string | null;
  device_id?: string | null;
  notes?: string | null;
  action_time?: string;
}

export interface UpdateCountItemInput {
  counted_quantity: number;
  condition: StockCountItemCondition;
  notes?: string | null;
  action_time?: string;
}

const ACTIVE_STATUSES = new Set<string>([
  StockCountSessionStatus.DRAFT,
  StockCountSessionStatus.IN_PROGRESS,
  StockCountSessionStatus.SUBMITTED,
  StockCountSessionStatus.DISCREPANCY_FOUND,
]);

function serviceError(statusCode: number, vi: string, zh: string): ServiceError {
  return Object.assign(new Error(vi), { statusCode, messages: { vi, zh } });
}

function reportNumber(now: Date, index: number) {
  return `NC-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(index + 1).padStart(3, "0")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function sessionNumber(now: Date) {
  return `SC-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

async function readCurrentInventory(locationId: string, productId: string) {
  const records = await findInventory({
    warehouse_location_id: locationId,
    product_id: productId,
  });
  return records[0] ?? null;
}

async function enrichSessions(sessions: StockCountSession[]) {
  const locationIds = [...new Set(sessions.map((s) => s.warehouse_location_id).filter(Boolean))] as string[];
  const warehouseIds = [...new Set(sessions.map((s) => s.warehouse_id).filter(Boolean))];
  const userIds = [...new Set(sessions.flatMap((s) => [s.counter_id, s.cancelled_by]).filter(Boolean))] as string[];
  const [locations, warehouses, users] = await Promise.all([
    Promise.all(locationIds.map(async (id) => [id, await locationRepository.findById(id)] as const)),
    Promise.all(warehouseIds.map(async (id) => [id, await warehouseRepository.findById(id)] as const)),
    getUsersByIds(userIds),
  ]);
  const locationById = new Map(locations);
  const warehouseById = new Map(warehouses);
  const userById = new Map(users.map((u) => [u.id, u]));

  return sessions.map((session) => {
    const location = session.warehouse_location_id ? locationById.get(session.warehouse_location_id) : null;
    const warehouse = warehouseById.get(session.warehouse_id);
    const counter = session.counter_id ? userById.get(session.counter_id) : null;
    const cancelledBy = session.cancelled_by ? userById.get(session.cancelled_by) : null;
    return {
      ...session,
      warehouse_name: warehouse?.name ?? null,
      warehouse_code: warehouse?.code ?? null,
      location_name: location?.name ?? null,
      location_code: location?.code ?? null,
      counter_name: counter?.full_name ?? session.external_operator_name ?? null,
      cancelled_by_name: cancelledBy?.full_name ?? null,
    };
  });
}

export async function listExternalCountSessions(filters: StockCountSessionFilters) {
  const sessions = await findSessions({
    ...filters,
    source: StockCountSource.EXTERNAL_API,
  });
  return enrichSessions(sessions);
}

export async function getExternalCountDetail(id: string) {
  const session = await findSessionById(id);
  if (!session || session.source !== StockCountSource.EXTERNAL_API) {
    throw serviceError(404, "Khong tim thay phien kiem dem.", "未找到盘点会话。");
  }
  const [enrichedSession] = await enrichSessions([session]);
  const items = await findItemsBySessionId(id);
  const products = await productRepository.findByIds(items.map((item) => item.product_id));
  const productById = new Map(products.map((product) => [product.id, product]));
  const enrichedItems = await Promise.all(
    items.map(async (item) => {
      const product = productById.get(item.product_id);
      const current = await readCurrentInventory(item.warehouse_location_id, item.product_id);
      return {
        ...item,
        current_atp: current?.atp_quantity ?? item.current_atp ?? null,
        product_name: product?.name ?? null,
        product_code: product?.code ?? null,
        product_barcode: product?.barcode ?? null,
        product_unit: product?.unit ?? null,
        product_image_url: product?.product_image_url?.[0] ?? null,
      };
    }),
  );

  return { session: enrichedSession, items: enrichedItems };
}

export async function createExternalCountSession(
  input: CreateExternalCountInput,
  userId: string,
  auditMetadata?: AuditMetadata,
) {
  const existing = await findSessions({
    warehouse_id: input.warehouse_id,
    warehouse_location_id: input.warehouse_location_id,
    business_date: input.business_date,
    source: StockCountSource.EXTERNAL_API,
  });
  const duplicate = existing.find(
    (session) =>
      session.count_purpose === input.count_purpose &&
      ACTIVE_STATUSES.has(session.status),
  );
  if (duplicate) {
    throw serviceError(409, "Da co phien kiem dem dang mo cho quay nay.", "该柜台已有未完成盘点。");
  }

  const inventory = (await findInventory({
    warehouse_id: input.warehouse_id,
    warehouse_location_id: input.warehouse_location_id,
  })).filter((record) => record.atp_quantity > 0);
  if (inventory.length === 0) {
    throw serviceError(400, "Quay nay khong co ton ATP de kiem dem.", "该柜台没有可盘点ATP库存。");
  }

  const now = new Date();
  const sessionId = randomUUID();
  const session: StockCountSession = {
    id: sessionId,
    session_number: sessionNumber(now),
    warehouse_id: input.warehouse_id,
    warehouse_location_id: input.warehouse_location_id,
    count_type: StockCountType.EXTERNAL,
    count_purpose: input.count_purpose,
    source: StockCountSource.EXTERNAL_API,
    status: StockCountSessionStatus.IN_PROGRESS,
    counter_id: userId,
    supervisor_id: null,
    external_operator_name: input.external_operator_name ?? null,
    external_operator_id: input.external_operator_id ?? null,
    external_client_id: null,
    device_id: input.device_id ?? null,
    business_date: input.business_date,
    blind_count_enabled: input.blind_count_enabled,
    started_at: now,
    completed_at: null,
    submitted_at: null,
    cancelled_at: null,
    cancelled_by: null,
    cancel_reason: null,
    discrepancy_count: 0,
    action_time: input.action_time ? new Date(input.action_time) : now,
    sync_time: now,
    notes: input.notes ?? null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };

  const batch = db.batch();
  batch.set(sessionsCollection().doc(sessionId), session);
  for (const record of inventory) {
    const itemId = randomUUID();
    const item: StockCountItem = {
      id: itemId,
      session_id: sessionId,
      inventory_id: record.id,
      product_id: record.product_id,
      warehouse_location_id: record.warehouse_location_id,
      system_quantity: record.atp_quantity,
      atp_snapshot: record.atp_quantity,
      expected_at_count_time: null,
      current_atp: record.atp_quantity,
      counted_quantity: null,
      counted_at: null,
      discrepancy: 0,
      condition: StockCountItemCondition.GOOD,
      has_discrepancy: false,
      movement_delta_before_count: 0,
      movement_delta_after_count: 0,
      evidence_urls: [],
      notes: null,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    };
    batch.set(itemsCollection().doc(itemId), item);
  }
  await batch.commit();

  await logAudit({
    entity_type: "STOCK_COUNT_SESSION",
    entity_id: sessionId,
    warehouse_id: input.warehouse_id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: { ...session, item_count: inventory.length },
    ...auditMetadata,
  });

  return getExternalCountDetail(sessionId);
}

export async function updateExternalCountItem(
  sessionId: string,
  itemId: string,
  input: UpdateCountItemInput,
  userId: string,
  auditMetadata?: AuditMetadata,
) {
  const session = await findSessionById(sessionId);
  if (!session || session.source !== StockCountSource.EXTERNAL_API) {
    throw serviceError(404, "Khong tim thay phien kiem dem.", "未找到盘点会话。");
  }
  if (!ACTIVE_STATUSES.has(session.status)) {
    throw serviceError(409, "Phien kiem dem khong con duoc sua.", "盘点会话不可再编辑。");
  }
  const itemSnap = await itemsCollection().doc(itemId).get();
  if (!itemSnap.exists) {
    throw serviceError(404, "Khong tim thay dong kiem dem.", "未找到盘点明细。");
  }
  const item = itemSnap.data() as StockCountItem;
  if (item.session_id !== sessionId || item.is_deleted) {
    throw serviceError(404, "Khong tim thay dong kiem dem.", "未找到盘点明细。");
  }

  const now = new Date();
  const inventory = await readCurrentInventory(item.warehouse_location_id, item.product_id);
  const expected = item.expected_at_count_time ?? inventory?.atp_quantity ?? item.atp_snapshot;
  const discrepancy = input.counted_quantity - expected;

  await itemsCollection().doc(itemId).update({
    counted_quantity: input.counted_quantity,
    condition: input.condition,
    notes: input.notes ?? null,
    expected_at_count_time: expected,
    current_atp: inventory?.atp_quantity ?? null,
    counted_at: item.counted_at ?? now,
    discrepancy,
    has_discrepancy: discrepancy !== 0 || input.condition !== StockCountItemCondition.GOOD,
    movement_delta_before_count: expected - item.atp_snapshot,
    updated_at: now,
  });
  await sessionsCollection().doc(sessionId).update({ status: StockCountSessionStatus.IN_PROGRESS, updated_at: now });

  await logAudit({
    entity_type: "STOCK_COUNT_ITEM",
    entity_id: itemId,
    warehouse_id: session.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: item as unknown as Record<string, unknown>,
    new_value: { counted_quantity: input.counted_quantity, expected_at_count_time: expected, discrepancy },
    ...auditMetadata,
  });

  return getExternalCountDetail(sessionId);
}

function issueTypeFor(item: StockCountItem) {
  if (item.condition === StockCountItemCondition.DAMAGED) return IssueType.DAMAGED;
  if (item.condition === StockCountItemCondition.EXPIRED) return IssueType.EXPIRED;
  if (item.condition === StockCountItemCondition.MISSING) return IssueType.MISSING;
  return IssueType.DISCREPANCY;
}

export async function submitExternalCountSession(
  sessionId: string,
  userId: string,
  auditMetadata?: AuditMetadata,
) {
  const session = await findSessionById(sessionId);
  if (!session || session.source !== StockCountSource.EXTERNAL_API) {
    throw serviceError(404, "Khong tim thay phien kiem dem.", "未找到盘点会话。");
  }
  if (session.status === StockCountSessionStatus.CANCELLED) {
    throw serviceError(409, "Phien kiem dem da huy.", "盘点会话已取消。");
  }
  const items = await findItemsBySessionId(sessionId);
  if (items.some((item) => item.counted_quantity === null || item.expected_at_count_time === null)) {
    throw serviceError(400, "Vui long nhap du so dem truoc khi nop.", "提交前请录入所有盘点数量。");
  }

  const now = new Date();
  const exceptions = items.filter(
    (item) => item.has_discrepancy || item.condition !== StockCountItemCondition.GOOD,
  );

  await db.runTransaction(async (txn) => {
    const exceptionInventory = new Map<string, Inventory>();
    for (const item of exceptions) {
      if (!item.inventory_id) continue;
      const invSnap = await txn.get(db.collection("inventory").doc(item.inventory_id));
      if (!invSnap.exists) {
        throw serviceError(400, "Khong tim thay ton kho lien quan.", "未找到相关库存。");
      }
      exceptionInventory.set(item.inventory_id, invSnap.data() as Inventory);
    }

    for (const item of items) {
      if (!item.inventory_id) continue;
      txn.update(db.collection("inventory").doc(item.inventory_id), { last_count_at: now, last_updated_at: now });
    }

    for (let index = 0; index < exceptions.length; index += 1) {
      const item = exceptions[index];
      const quantity = Math.max(1, Math.abs(item.discrepancy || item.counted_quantity || 0));
      const issueType = issueTypeFor(item);
      const reportId = randomUUID();
      const quarantineId =
        issueType === IssueType.DAMAGED || issueType === IssueType.EXPIRED
          ? randomUUID()
          : null;

      if (item.inventory_id) {
        const invRef = db.collection("inventory").doc(item.inventory_id);
        const inventory = exceptionInventory.get(item.inventory_id);
        if (!inventory) throw serviceError(400, "Khong tim thay ton kho lien quan.", "未找到相关库存。");
        const shouldReduceAtp = item.discrepancy < 0 || Boolean(quarantineId);
        const reducedAtp = shouldReduceAtp
          ? Math.min(quantity, inventory.atp_quantity)
          : 0;
        const atp = inventory.atp_quantity - reducedAtp;
        const onHoldIncrease =
          item.discrepancy > 0 ? quantity : item.discrepancy < 0 ? reducedAtp : 0;
        const quarantineIncrease = quarantineId ? reducedAtp : 0;
        const onHold = inventory.on_hold_quantity + onHoldIncrease;
        const quarantine = inventory.quarantine_quantity + quarantineIncrease;
        txn.update(invRef, {
          atp_quantity: atp,
          on_hold_quantity: onHold,
          quarantine_quantity: quarantine,
          total_quantity: calculateInventoryTotalQuantity({
            atp_quantity: atp,
            on_hold_quantity: onHold,
            in_transit_quantity: inventory.in_transit_quantity,
            quarantine_quantity: quarantine,
          }),
          last_updated_at: now,
        });
      }

      txn.set(db.collection("nonconformity_reports").doc(reportId), {
        id: reportId,
        report_number: reportNumber(now, index),
        source_type: NonconformitySourceType.STOCK_COUNT,
        source_id: sessionId,
        warehouse_id: session.warehouse_id,
        warehouse_location_id: item.warehouse_location_id,
        product_id: item.product_id,
        quantity_affected: quantity,
        source_item_id: item.id,
        expected_quantity: item.expected_at_count_time,
        actual_quantity: item.counted_quantity,
        issue_type: issueType,
        status: quarantineId ? NonconformityStatus.QUARANTINED : NonconformityStatus.OPEN,
        reporter_id: userId,
        reviewer_id: null,
        resolved_by: null,
        resolution_type: null,
        resolution_notes: null,
        requires_evidence: true,
        action_time: now,
        sync_time: now,
        is_deleted: false,
        created_at: now,
        updated_at: now,
      });

      if (quarantineId) {
        txn.set(db.collection("quarantine_records").doc(quarantineId), {
          id: quarantineId,
          nonconformity_report_id: reportId,
          product_id: item.product_id,
          warehouse_location_id: item.warehouse_location_id,
          quantity,
          quarantine_reason: `Stock count ${session.session_number}`,
          quarantined_at: now,
          released_at: null,
          released_by: null,
          release_notes: null,
          status: QuarantineStatus.QUARANTINED,
          is_deleted: false,
        });
      }
    }

    txn.update(sessionsCollection().doc(sessionId), {
      status:
        exceptions.length > 0
          ? StockCountSessionStatus.DISCREPANCY_FOUND
          : StockCountSessionStatus.VERIFIED,
      completed_at: exceptions.length > 0 ? null : now,
      submitted_at: now,
      discrepancy_count: exceptions.length,
      sync_time: now,
      updated_at: now,
    });
  });

  await logAudit({
    entity_type: "STOCK_COUNT_SESSION",
    entity_id: sessionId,
    warehouse_id: session.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: session as unknown as Record<string, unknown>,
    new_value: { submitted_at: now, discrepancy_count: exceptions.length },
    ...auditMetadata,
  });

  return getExternalCountDetail(sessionId);
}

export async function cancelExternalCountSession(
  sessionId: string,
  reason: string,
  userId: string,
  auditMetadata?: AuditMetadata,
) {
  const session = await findSessionById(sessionId);
  if (!session || session.source !== StockCountSource.EXTERNAL_API) {
    throw serviceError(404, "Khong tim thay phien kiem dem.", "未找到盘点会话。");
  }
  if (!ACTIVE_STATUSES.has(session.status)) {
    throw serviceError(409, "Phien kiem dem khong the huy.", "盘点会话不可取消。");
  }
  const now = new Date();
  await sessionsCollection().doc(sessionId).update({
    status: StockCountSessionStatus.CANCELLED,
    cancelled_at: now,
    cancelled_by: userId,
    cancel_reason: reason,
    updated_at: now,
  });
  await logAudit({
    entity_type: "STOCK_COUNT_SESSION",
    entity_id: sessionId,
    warehouse_id: session.warehouse_id,
    action: AuditAction.CANCEL,
    user_id: userId,
    old_value: session as unknown as Record<string, unknown>,
    new_value: { status: StockCountSessionStatus.CANCELLED, cancel_reason: reason },
    ...auditMetadata,
  });
  return getExternalCountDetail(sessionId);
}

export async function isExternalCountGateOpen(params: {
  warehouseId: string;
  warehouseLocationId: string;
  businessDate: string;
}) {
  const sessions = await findSessions({
    warehouse_id: params.warehouseId,
    warehouse_location_id: params.warehouseLocationId,
    business_date: params.businessDate,
    source: StockCountSource.EXTERNAL_API,
  });
  return sessions.some(
    (session) =>
      session.count_purpose === StockCountPurpose.EXTERNAL_CLOSING &&
      [StockCountSessionStatus.VERIFIED, StockCountSessionStatus.COMPLETED, StockCountSessionStatus.RESOLVED].includes(session.status),
  );
}
