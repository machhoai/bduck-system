import { randomUUID } from "node:crypto";

import { AuditAction } from "@bduck/shared-types";
import { FieldValue, type Timestamp } from "firebase-admin/firestore";

import { db } from "../config/firebase.js";
import { posInvoiceOrderRepository } from "../repositories/posInvoiceOrderRepository.js";

import { logAudit, type AuditMetadata } from "./auditService.js";
import {
  getJoyworldToken,
  getOrderGoodsList,
  getOrderList,
  type RevenueOverviewResponse,
} from "./joyworldService.js";
import { resolvePartnerSyncStartDate } from "./partnerPosOrderSyncPolicy.js";
import { buildHistoricalPosOrder } from "./posOrderHistoricalBackfill.js";

type JsonRecord = Record<string, unknown>;

const PAGE_SIZE = 200;
const WRITE_BATCH_SIZE = 400;
const SOURCE_SYSTEM = "JOYWORLD";
const ACTIVE_RUN_TIMEOUT_MS = 15 * 60 * 1000;

class PartnerPosSyncError extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly messages: { vi: string; zh: string },
  ) {
    super(message);
  }
}

interface PartnerSyncState {
  status?: string;
  started_at?: Timestamp | null;
  last_successful_end_date?: string | null;
}

export interface PartnerPosSyncResult {
  run_id: string;
  warehouse_id: string;
  start_date: string;
  end_date: string;
  source_order_count: number;
  completed_order_count: number;
  inserted_count: number;
  skipped_existing_count: number;
  imported_revenue: number;
  completed_at: string;
}

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

const responseRows = (response: RevenueOverviewResponse): JsonRecord[] => {
  if (Array.isArray(response.data)) return response.data.map(asRecord);
  const data = asRecord(response.data);
  for (const candidate of [
    data.dataXs,
    data.records,
    data.rows,
    data.list,
    data.items,
  ]) {
    if (Array.isArray(candidate)) return candidate.map(asRecord);
  }
  return [];
};

const responseTotal = (response: RevenueOverviewResponse): number => {
  const data = asRecord(response.data);
  for (const value of [
    response.totals,
    response.total,
    data.totals,
    data.total,
  ]) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
};

const fetchAllPages = async (
  fetchPage: (page: number) => Promise<RevenueOverviewResponse>,
): Promise<JsonRecord[]> => {
  const result: JsonRecord[] = [];
  for (let page = 1; page <= 10_000; page += 1) {
    const response = await fetchPage(page);
    if (response.success === false) {
      throw new Error(`PARTNER_RESPONSE_FAILED:${String(response.code ?? "UNKNOWN")}`);
    }
    const rows = responseRows(response);
    result.push(...rows);
    const expected = responseTotal(response);
    if (
      rows.length === 0 ||
      rows.length < PAGE_SIZE ||
      (expected > 0 && result.length >= expected)
    ) {
      return result;
    }
  }
  throw new Error("PARTNER_PAGINATION_LIMIT_EXCEEDED");
};

const vietnamDate = (value = new Date()): string =>
  new Date(value.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

const inferLatestPartnerDate = async (
  warehouseId: string,
): Promise<string | null> => {
  const snapshot = await db
    .collection("pos_orders")
    .where("warehouseId", "==", warehouseId)
    .orderBy("paidAt", "asc")
    .get();
  const document = [...snapshot.docs].reverse().find(
    (item) => item.data().historicalImport?.sourceSystem === SOURCE_SYSTEM,
  );
  const paidAt = document?.data().paidAt;
  return typeof paidAt === "string" && paidAt ? vietnamDate(new Date(paidAt)) : null;
};

const resolveShopId = async (warehouseId: string): Promise<number> => {
  const snapshot = await db
    .collection("pos_orders")
    .where("warehouseId", "==", warehouseId)
    .limit(1)
    .get();
  const shopId = Number(snapshot.docs[0]?.data().shopId);
  if (!Number.isFinite(shopId) || shopId <= 0) {
    throw new PartnerPosSyncError(
      "POS_SHOP_ID_MISSING",
      422,
      {
        vi: "Chưa xác định được mã cửa hàng POS để đồng bộ.",
        zh: "无法确定用于同步的 POS 门店编号。",
      },
    );
  }
  return shopId;
};

const reserveRun = async (
  warehouseId: string,
  actorId: string,
): Promise<{ runId: string; state: PartnerSyncState }> => {
  const reference = db.collection("pos_partner_sync_states").doc(warehouseId);
  const runId = randomUUID();
  return db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(reference);
    const state = snapshot.exists
      ? (snapshot.data() as PartnerSyncState)
      : {};
    const startedAt = state.started_at?.toDate?.();
    if (
      state.status === "RUNNING" &&
      startedAt &&
      Date.now() - startedAt.getTime() < ACTIVE_RUN_TIMEOUT_MS
    ) {
      throw new PartnerPosSyncError(
        "PARTNER_POS_SYNC_ALREADY_RUNNING",
        409,
        {
          vi: "Một phiên đồng bộ POS đối tác đang chạy.",
          zh: "合作方 POS 同步任务正在运行。",
        },
      );
    }
    transaction.set(
      reference,
      {
        warehouse_id: warehouseId,
        source_system: SOURCE_SYSTEM,
        status: "RUNNING",
        active_run_id: runId,
        started_at: FieldValue.serverTimestamp(),
        started_by: actorId,
        error_code: null,
      },
      { merge: true },
    );
    return { runId, state };
  });
};

const existingDocumentIds = async (ids: string[]): Promise<Set<string>> => {
  const result = new Set<string>();
  for (let cursor = 0; cursor < ids.length; cursor += 300) {
    const refs = ids
      .slice(cursor, cursor + 300)
      .map((id) => db.collection("pos_orders").doc(id));
    const snapshots = refs.length > 0 ? await db.getAll(...refs) : [];
    snapshots.forEach((snapshot) => {
      if (snapshot.exists) result.add(snapshot.id);
    });
  }
  return result;
};

export const syncPartnerOrdersToPos = async (input: {
  warehouseId: string;
  actorId: string;
  auditMetadata?: AuditMetadata;
}): Promise<PartnerPosSyncResult> => {
  const stateRef = db.collection("pos_partner_sync_states").doc(input.warehouseId);
  const { runId, state } = await reserveRun(input.warehouseId, input.actorId);
  try {
    const endDate = vietnamDate();
    const inferredDate = state.last_successful_end_date
      ? null
      : await inferLatestPartnerDate(input.warehouseId);
    const startDate = resolvePartnerSyncStartDate(
      state.last_successful_end_date ?? inferredDate,
    );
    const shopId = await resolveShopId(input.warehouseId);
    const token = await getJoyworldToken();
    const range = {
      startTime: `${startDate} 00:00:00`,
      endTime: `${endDate} 23:59:59`,
    };
    const [sourceOrders, sourceGoods] = await Promise.all([
      fetchAllPages((page) =>
        getOrderList(token, { ...range, page, limit: PAGE_SIZE }),
      ),
      fetchAllPages((page) =>
        getOrderGoodsList(token, { ...range, page, limit: PAGE_SIZE }),
      ),
    ]);
    const goodsByOrder = new Map<string, JsonRecord[]>();
    for (const goods of sourceGoods) {
      const orderId = String(goods.orderId ?? "");
      if (!orderId) continue;
      goodsByOrder.set(orderId, [...(goodsByOrder.get(orderId) ?? []), goods]);
    }
    const importedAt = new Date().toISOString();
    const candidates = sourceOrders
      .map((order) => {
        const sourceOrderId = String(order.orderId ?? order.id ?? "");
        return buildHistoricalPosOrder({
          order,
          goods: goodsByOrder.get(sourceOrderId) ?? [],
          warehouseId: input.warehouseId,
          shopId,
          importedAt,
          rangeStart: startDate,
          rangeEnd: endDate,
        });
      })
      .filter((value): value is NonNullable<typeof value> => Boolean(value));
    const [existingIds, nativeOrdersByHkNumber] = await Promise.all([
      existingDocumentIds(candidates.map((candidate) => candidate.id)),
      posInvoiceOrderRepository.mapByHkOrderNumbers(
        candidates
          .map((candidate) => candidate.value.hkOrderNumber)
          .filter((value): value is string =>
            typeof value === "string" && Boolean(value),
          ),
      ),
    ]);
    const writes = candidates.filter((candidate) => {
      const hkOrderNumber = candidate.value.hkOrderNumber;
      return (
        !existingIds.has(candidate.id) &&
        (typeof hkOrderNumber !== "string" ||
          !nativeOrdersByHkNumber.has(hkOrderNumber))
      );
    });

    for (let cursor = 0; cursor < writes.length; cursor += WRITE_BATCH_SIZE) {
      const batch = db.batch();
      for (const candidate of writes.slice(cursor, cursor + WRITE_BATCH_SIZE)) {
        batch.create(db.collection("pos_orders").doc(candidate.id), candidate.value);
      }
      await batch.commit();
    }

    const result: PartnerPosSyncResult = {
      run_id: runId,
      warehouse_id: input.warehouseId,
      start_date: startDate,
      end_date: endDate,
      source_order_count: sourceOrders.length,
      completed_order_count: candidates.length,
      inserted_count: writes.length,
      skipped_existing_count: candidates.length - writes.length,
      imported_revenue: writes.reduce(
        (sum, candidate) => sum + Number(candidate.value.totalAmount ?? 0),
        0,
      ),
      completed_at: new Date().toISOString(),
    };
    await stateRef.set(
      {
        status: "COMPLETED",
        active_run_id: null,
        last_run_id: runId,
        last_successful_start_date: startDate,
        last_successful_end_date: endDate,
        last_result: result,
        completed_at: FieldValue.serverTimestamp(),
        error_code: null,
      },
      { merge: true },
    );
    await logAudit({
      entity_type: "POS_ORDER",
      entity_id: runId,
      warehouse_id: input.warehouseId,
      action: AuditAction.CREATE,
      user_id: input.actorId,
      old_value: null,
      new_value: result as unknown as Record<string, unknown>,
      notes: "Incremental partner POS orders synchronized into JPOS local data",
      ...input.auditMetadata,
    });
    return result;
  } catch (error) {
    await stateRef.set(
      {
        status: "FAILED",
        active_run_id: null,
        last_run_id: runId,
        completed_at: FieldValue.serverTimestamp(),
        error_code:
          error instanceof Error ? error.message.slice(0, 160) : "UNKNOWN",
      },
      { merge: true },
    );
    throw error;
  }
};

export { PartnerPosSyncError };
