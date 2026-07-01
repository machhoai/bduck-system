import { randomUUID } from "crypto";
import {
  AuditAction,
  ExternalCountCheckpointType,
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
import type {
  IntegrationClient,
  Inventory,
  Product,
  StockCountItem,
  StockCountSession,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { findAll as findInventory } from "../repositories/inventoryRepository.js";
import { locationRepository } from "../repositories/locationRepository.js";
import { productRepository } from "../repositories/productRepository.js";
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
import { getExternalCountRequirement } from "./externalCountConfigService.js";

type ServiceError = Error & { statusCode: number; messages: Record<string, string> };

export interface ExternalCountCheckpointItemInput {
  barcode?: string | null;
  product_id?: string | null;
  counted_quantity: number;
  base_atp?: number | null;
  condition?: StockCountItemCondition;
  evidence_urls?: string[];
  notes?: string | null;
}

export interface ExternalCountCheckpointInput {
  warehouse_id: string;
  warehouse_location_id: string;
  checkpoint_type: ExternalCountCheckpointType;
  business_date: string;
  idempotency_key: string;
  external_operator_name?: string | null;
  external_operator_id?: string | null;
  device_id?: string | null;
  notes?: string | null;
  action_time?: string;
  items: ExternalCountCheckpointItemInput[];
}

function serviceError(statusCode: number, vi: string, zh: string): ServiceError {
  return Object.assign(new Error(vi), { statusCode, messages: { vi, zh } });
}

function sessionNumber(now: Date) {
  return `ESC-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function reportNumber(now: Date, index: number) {
  return `NC-${now.toISOString().slice(0, 10).replace(/-/g, "")}-${String(index + 1).padStart(3, "0")}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function purposeFromCheckpoint(type: ExternalCountCheckpointType) {
  return type === ExternalCountCheckpointType.BEFORE_SCAN
    ? StockCountPurpose.EXTERNAL_OPENING
    : StockCountPurpose.EXTERNAL_CLOSING;
}

function issueTypeFor(item: StockCountItem) {
  if (item.condition === StockCountItemCondition.DAMAGED) return IssueType.DAMAGED;
  if (item.condition === StockCountItemCondition.EXPIRED) return IssueType.EXPIRED;
  if (item.condition === StockCountItemCondition.MISSING) return IssueType.MISSING;
  return IssueType.DISCREPANCY;
}

async function resolveProduct(input: ExternalCountCheckpointItemInput) {
  if (input.product_id) {
    const product = await productRepository.findById(input.product_id);
    if (!product) throw serviceError(404, "Khong tim thay san pham.", "未找到产品。");
    return product;
  }
  if (input.barcode) {
    const product = await productRepository.findByBarcode(input.barcode);
    if (!product) throw serviceError(404, "Khong tim thay barcode.", "未找到条码。");
    return product;
  }
  throw serviceError(400, "Moi dong can co barcode hoac product_id.", "每一行都需要条码或产品ID。");
}

async function enrichSessions(sessions: StockCountSession[]) {
  const locationIds = [...new Set(sessions.map((s) => s.warehouse_location_id).filter(Boolean))] as string[];
  const warehouseIds = [...new Set(sessions.map((s) => s.warehouse_id).filter(Boolean))];
  const [locations, warehouses] = await Promise.all([
    Promise.all(locationIds.map(async (id) => [id, await locationRepository.findById(id)] as const)),
    Promise.all(warehouseIds.map(async (id) => [id, await warehouseRepository.findById(id)] as const)),
  ]);
  const locationById = new Map(locations);
  const warehouseById = new Map(warehouses);

  return sessions.map((session) => {
    const location = session.warehouse_location_id ? locationById.get(session.warehouse_location_id) : null;
    const warehouse = warehouseById.get(session.warehouse_id);
    return {
      ...session,
      warehouse_name: warehouse?.name ?? null,
      warehouse_code: warehouse?.code ?? null,
      location_name: location?.name ?? null,
      location_code: location?.code ?? null,
      counter_name: session.external_operator_name ?? null,
    };
  });
}

export async function listExternalCountSessions(filters: StockCountSessionFilters) {
  const sessions = await findSessions({ ...filters, source: StockCountSource.EXTERNAL_API });
  return enrichSessions(sessions);
}

export async function getExternalCountDetail(id: string) {
  const session = await findSessionById(id);
  if (!session || session.source !== StockCountSource.EXTERNAL_API) {
    throw serviceError(404, "Khong tim thay checkpoint kiem dem.", "未找到盘点检查点。");
  }

  const [enrichedSession] = await enrichSessions([session]);
  const items = await findItemsBySessionId(id);
  const products = await productRepository.findByIds(items.map((item) => item.product_id));
  const productById = new Map(products.map((product) => [product.id, product]));

  return {
    session: enrichedSession,
    items: items.map((item) => {
      const product = productById.get(item.product_id);
      return {
        ...item,
        product_name: product?.name ?? null,
        product_code: product?.code ?? null,
        product_barcode: product?.barcode ?? null,
        product_unit: product?.unit ?? null,
        product_image_url: product?.product_image_url?.[0] ?? null,
      };
    }),
  };
}

function validateClientAccess(client: IntegrationClient, warehouseId: string) {
  if (!client.allowed_warehouse_ids.includes(warehouseId)) {
    throw serviceError(403, "Client khong co quyen voi kho nay.", "客户端无权访问该仓库。");
  }
}

async function assertLocation(warehouseId: string, locationId: string) {
  const location = await locationRepository.findById(locationId);
  if (!location || location.warehouse_id !== warehouseId || location.is_deleted) {
    throw serviceError(400, "Quay khong hop le voi kho.", "库位与仓库不匹配。");
  }
}

async function buildCountItems(
  sessionId: string,
  locationId: string,
  inputs: ExternalCountCheckpointItemInput[],
  now: Date,
) {
  const products = await Promise.all(inputs.map(resolveProduct));
  const inventory = await findInventory({ warehouse_location_id: locationId });
  const inventoryByProductId = new Map(inventory.map((record) => [record.product_id, record]));

  return inputs.map((input, index) => {
    const product = products[index] as Product;
    const inventoryRecord = inventoryByProductId.get(product.id) ?? null;
    const currentAtp = Number(inventoryRecord?.atp_quantity ?? 0);
    const baseAtp = input.base_atp ?? null;
    const expected = baseAtp ?? currentAtp;
    const condition = input.condition ?? StockCountItemCondition.GOOD;
    const discrepancy = input.counted_quantity - expected;
    const hasIssue = discrepancy !== 0 || condition !== StockCountItemCondition.GOOD;
    const evidenceUrls = input.evidence_urls ?? [];

    if (hasIssue && evidenceUrls.length === 0) {
      throw serviceError(
        400,
        `Dong ${product.barcode || product.code} co chenh lech/hang loi nen can evidence_urls.`,
        "存在差异或异常品时必须提供凭证图片。",
      );
    }

    const item: StockCountItem = {
      id: randomUUID(),
      session_id: sessionId,
      inventory_id: inventoryRecord?.id ?? null,
      product_id: product.id,
      warehouse_location_id: locationId,
      system_quantity: expected,
      atp_snapshot: currentAtp,
      expected_at_count_time: expected,
      current_atp: currentAtp,
      counted_quantity: input.counted_quantity,
      counted_at: now,
      discrepancy,
      condition,
      has_discrepancy: hasIssue,
      movement_delta_before_count: baseAtp == null ? 0 : currentAtp - baseAtp,
      movement_delta_after_count: 0,
      evidence_urls: evidenceUrls,
      base_atp: baseAtp,
      movement_detected: baseAtp != null && baseAtp !== currentAtp,
      notes: input.notes ?? null,
      is_deleted: false,
      created_at: now,
      updated_at: now,
    };

    return { item, product, inventoryRecord };
  });
}

async function writeNonconformities(
  txn: FirebaseFirestore.Transaction,
  session: StockCountSession,
  exceptions: StockCountItem[],
  inventoryById: Map<string, Inventory>,
  reporterId: string,
  now: Date,
) {
  exceptions.forEach((item, index) => {
    const quantity = Math.max(1, Math.abs(item.discrepancy || item.counted_quantity || 0));
    const issueType = issueTypeFor(item);
    const reportId = randomUUID();
    const quarantineId =
      issueType === IssueType.DAMAGED || issueType === IssueType.EXPIRED ? randomUUID() : null;

    if (item.inventory_id) {
      const inventory = inventoryById.get(item.inventory_id);
      if (!inventory) throw serviceError(400, "Khong tim thay ton kho lien quan.", "未找到相关库存。");
      const shouldReduceAtp = item.discrepancy < 0 || Boolean(quarantineId);
      const reducedAtp = shouldReduceAtp ? Math.min(quantity, inventory.atp_quantity) : 0;
      const nextAtp = inventory.atp_quantity - reducedAtp;
      const onHoldIncrease = item.discrepancy > 0 ? quantity : item.discrepancy < 0 ? reducedAtp : 0;
      const quarantineIncrease = quarantineId ? reducedAtp : 0;
      const nextOnHold = inventory.on_hold_quantity + onHoldIncrease;
      const nextQuarantine = inventory.quarantine_quantity + quarantineIncrease;

      txn.update(db.collection("inventory").doc(item.inventory_id), {
        atp_quantity: nextAtp,
        on_hold_quantity: nextOnHold,
        quarantine_quantity: nextQuarantine,
        total_quantity: calculateInventoryTotalQuantity({
          atp_quantity: nextAtp,
          on_hold_quantity: nextOnHold,
          in_transit_quantity: inventory.in_transit_quantity,
          quarantine_quantity: nextQuarantine,
        }),
        last_count_at: now,
        last_updated_at: now,
      });
    }

    txn.set(db.collection("nonconformity_reports").doc(reportId), {
      id: reportId,
      report_number: reportNumber(now, index),
      source_type: NonconformitySourceType.STOCK_COUNT,
      source_id: session.id,
      warehouse_id: session.warehouse_id,
      warehouse_location_id: item.warehouse_location_id,
      product_id: item.product_id,
      quantity_affected: quantity,
      source_item_id: item.id,
      expected_quantity: item.expected_at_count_time,
      actual_quantity: item.counted_quantity,
      evidence_urls: item.evidence_urls ?? [],
      issue_type: issueType,
      status: quarantineId ? NonconformityStatus.QUARANTINED : NonconformityStatus.OPEN,
      reporter_id: reporterId,
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
        quarantine_reason: `External count ${session.session_number}`,
        quarantined_at: now,
        released_at: null,
        released_by: null,
        release_notes: null,
        status: QuarantineStatus.QUARANTINED,
        is_deleted: false,
      });
    }
  });
}

export async function submitExternalCountCheckpoint(
  input: ExternalCountCheckpointInput,
  client: IntegrationClient,
  clientIp: string,
  auditMetadata?: AuditMetadata,
) {
  validateClientAccess(client, input.warehouse_id);
  await assertLocation(input.warehouse_id, input.warehouse_location_id);

  const duplicate = (await findSessions({
    warehouse_id: input.warehouse_id,
    warehouse_location_id: input.warehouse_location_id,
    business_date: input.business_date,
    source: StockCountSource.EXTERNAL_API,
  })).find((session) => session.external_client_id === client.id && session.idempotency_key === input.idempotency_key);
  if (duplicate) return getExternalCountDetail(duplicate.id);

  const now = new Date();
  const sessionId = randomUUID();
  const counted = await buildCountItems(sessionId, input.warehouse_location_id, input.items, now);
  const exceptions = counted.map(({ item }) => item).filter((item) => item.has_discrepancy);
  const status = exceptions.length > 0
    ? StockCountSessionStatus.DISCREPANCY_FOUND
    : StockCountSessionStatus.VERIFIED;
  const session: StockCountSession = {
    id: sessionId,
    session_number: sessionNumber(now),
    warehouse_id: input.warehouse_id,
    warehouse_location_id: input.warehouse_location_id,
    count_type: StockCountType.EXTERNAL,
    count_purpose: purposeFromCheckpoint(input.checkpoint_type),
    checkpoint_type: input.checkpoint_type,
    source: StockCountSource.EXTERNAL_API,
    status,
    counter_id: null,
    supervisor_id: null,
    external_operator_name: input.external_operator_name ?? null,
    external_operator_id: input.external_operator_id ?? null,
    external_client_id: client.id,
    device_id: input.device_id ?? null,
    business_date: input.business_date,
    idempotency_key: input.idempotency_key,
    blind_count_enabled: false,
    started_at: now,
    completed_at: status === StockCountSessionStatus.VERIFIED ? now : null,
    submitted_at: now,
    cancelled_at: null,
    cancelled_by: null,
    cancel_reason: null,
    discrepancy_count: exceptions.length,
    action_time: input.action_time ? new Date(input.action_time) : now,
    sync_time: now,
    notes: input.notes ?? null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };

  await db.runTransaction(async (txn) => {
    const inventoryById = new Map<string, Inventory>();
    for (const { inventoryRecord } of counted) {
      if (!inventoryRecord) continue;
      const snap = await txn.get(db.collection("inventory").doc(inventoryRecord.id));
      if (snap.exists) inventoryById.set(inventoryRecord.id, snap.data() as Inventory);
    }

    txn.set(sessionsCollection().doc(sessionId), session);
    counted.forEach(({ item }) => {
      txn.set(itemsCollection().doc(item.id), item);
      if (item.inventory_id) {
        txn.update(db.collection("inventory").doc(item.inventory_id), {
          last_count_at: now,
          last_updated_at: now,
        });
      }
    });
    await writeNonconformities(txn, session, exceptions, inventoryById, `EXT:${client.id}`, now);
  });

  await logAudit({
    entity_type: "STOCK_COUNT_SESSION",
    entity_id: sessionId,
    warehouse_id: input.warehouse_id,
    action: AuditAction.CREATE,
    user_id: `EXT:${client.id}`,
    old_value: null,
    new_value: { ...session, item_count: counted.length },
    ip_address: clientIp,
    device_id: input.device_id ?? null,
    action_time: auditMetadata?.action_time ?? session.action_time,
  });

  return getExternalCountDetail(sessionId);
}

export async function isExternalCountCheckpointSatisfied(params: {
  warehouseId: string;
  warehouseLocationId: string;
  businessDate: string;
  checkpointType: ExternalCountCheckpointType;
}) {
  const config = await getExternalCountRequirement();
  if (!config.enabled) return true;
  if (params.checkpointType === ExternalCountCheckpointType.BEFORE_SCAN && !config.require_before_scan) return true;
  if (params.checkpointType === ExternalCountCheckpointType.BEFORE_SUBMIT && !config.require_before_submit) return true;

  const sessions = await findSessions({
    warehouse_id: params.warehouseId,
    warehouse_location_id: params.warehouseLocationId,
    business_date: params.businessDate,
    source: StockCountSource.EXTERNAL_API,
  });
  return sessions.some(
    (session) =>
      session.checkpoint_type === params.checkpointType &&
      session.status === StockCountSessionStatus.VERIFIED,
  );
}

export async function getExternalCountState(params: {
  warehouseId: string;
  warehouseLocationId: string;
  businessDate: string;
}) {
  const config = await getExternalCountRequirement();
  const [beforeScanSatisfied, beforeSubmitSatisfied, sessions] = await Promise.all([
    isExternalCountCheckpointSatisfied({ ...params, checkpointType: ExternalCountCheckpointType.BEFORE_SCAN }),
    isExternalCountCheckpointSatisfied({ ...params, checkpointType: ExternalCountCheckpointType.BEFORE_SUBMIT }),
    listExternalCountSessions({
      warehouse_id: params.warehouseId,
      warehouse_location_id: params.warehouseLocationId,
      business_date: params.businessDate,
    }),
  ]);

  return {
    config,
    gates: {
      before_scan: beforeScanSatisfied,
      before_submit: beforeSubmitSatisfied,
    },
    checkpoints: sessions,
  };
}

export const isExternalCountGateOpen = async (params: {
  warehouseId: string;
  warehouseLocationId: string;
  businessDate: string;
}) =>
  isExternalCountCheckpointSatisfied({
    ...params,
    checkpointType: ExternalCountCheckpointType.BEFORE_SUBMIT,
  });
