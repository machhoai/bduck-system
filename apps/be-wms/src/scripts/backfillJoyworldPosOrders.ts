/* eslint-disable no-console */
import { db } from "../config/firebase.js";
import {
  getJoyworldToken,
  getOrderGoodsList,
  getOrderList,
  type RevenueOverviewResponse,
} from "../services/joyworldService.js";
import { buildHistoricalPosOrder } from "../services/posOrderHistoricalBackfill.js";

type JsonRecord = Record<string, unknown>;

const PAGE_SIZE = 200;
const WRITE_BATCH_SIZE = 400;

const argument = (name: string, fallback: string): string =>
  process.argv
    .find((value) => value.startsWith(`--${name}=`))
    ?.slice(name.length + 3) ?? fallback;

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

const rows = (response: RevenueOverviewResponse): JsonRecord[] => {
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

const total = (response: RevenueOverviewResponse): number => {
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

const fetchAll = async (
  fetchPage: (page: number) => Promise<RevenueOverviewResponse>,
  label: string,
): Promise<JsonRecord[]> => {
  const result: JsonRecord[] = [];
  for (let page = 1; page <= 10_000; page += 1) {
    const response = await fetchPage(page);
    if (response.success === false) {
      throw new Error(`${label}_FAILED:${String(response.code ?? "UNKNOWN")}`);
    }
    const pageRows = rows(response);
    result.push(...pageRows);
    const expected = total(response);
    if (page % 20 === 0 || pageRows.length < PAGE_SIZE) {
      console.log(`[${label}] ${result.length}/${expected || "?"}`);
    }
    if (
      pageRows.length === 0 ||
      pageRows.length < PAGE_SIZE ||
      (expected > 0 && result.length >= expected)
    ) {
      return result;
    }
  }
  throw new Error(`${label}_PAGINATION_LIMIT_EXCEEDED`);
};

const run = async () => {
  const start = argument("start", "2025-12-10");
  const end = argument("end", new Date().toISOString().slice(0, 10));
  const warehouseId = argument(
    "warehouse-id",
    "2fa83576-277f-483e-8c52-2ec85b9a8cff",
  );
  const shopId = Number(argument("shop-id", "20692"));
  const apply = process.argv.includes("--apply");
  const token = await getJoyworldToken();
  const range = {
    startTime: `${start} 00:00:00`,
    endTime: `${end} 23:59:59`,
  };

  const [sourceOrders, sourceGoods] = await Promise.all([
    fetchAll(
      (page) =>
        getOrderList(token, { ...range, page, limit: PAGE_SIZE }),
      "orders",
    ),
    fetchAll(
      (page) =>
        getOrderGoodsList(token, { ...range, page, limit: PAGE_SIZE }),
      "goods",
    ),
  ]);
  const goodsByOrder = new Map<string, JsonRecord[]>();
  for (const goods of sourceGoods) {
    const orderId = String(goods.orderId ?? "");
    if (!orderId) continue;
    goodsByOrder.set(orderId, [...(goodsByOrder.get(orderId) ?? []), goods]);
  }

  const existing = await db
    .collection("pos_orders")
    .where("warehouseId", "==", warehouseId)
    .get();
  const existingIds = new Set(existing.docs.map((document) => document.id));
  const existingHkNumbers = new Set(
    existing.docs
      .map((document) => document.data().hkOrderNumber)
      .filter((value): value is string =>
        typeof value === "string" && Boolean(value),
      ),
  );
  const importedAt = new Date().toISOString();
  const candidates = sourceOrders
    .map((order) => {
      const orderId = String(order.orderId ?? order.id ?? "");
      return buildHistoricalPosOrder({
        order,
        goods: goodsByOrder.get(orderId) ?? [],
        warehouseId,
        shopId,
        importedAt,
        rangeStart: start,
        rangeEnd: end,
      });
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));
  const writes = candidates.filter((candidate) => {
    const hkOrderNumber = candidate.value.hkOrderNumber;
    return (
      !existingIds.has(candidate.id) &&
      (typeof hkOrderNumber !== "string" ||
        !existingHkNumbers.has(hkOrderNumber))
    );
  });
  const statusCounts = sourceOrders.reduce<Record<string, number>>(
    (counts, order) => {
      const status = String(order.status ?? "UNKNOWN");
      counts[status] = (counts[status] ?? 0) + 1;
      return counts;
    },
    {},
  );
  const report = {
    mode: apply ? "APPLY" : "DRY_RUN",
    project: process.env.GOOGLE_CLOUD_PROJECT ?? null,
    start,
    end,
    warehouseId,
    sourceOrderCount: sourceOrders.length,
    sourceGoodsCount: sourceGoods.length,
    sourceStatusCounts: statusCounts,
    completedCandidateCount: candidates.length,
    existingPosOrderCount: existing.size,
    skippedExistingCount: candidates.length - writes.length,
    writeCount: writes.length,
    totalRevenue: writes.reduce(
      (sum, candidate) => sum + Number(candidate.value.totalAmount ?? 0),
      0,
    ),
  };
  console.log(JSON.stringify(report, null, 2));
  if (!apply) return;

  for (let cursor = 0; cursor < writes.length; cursor += WRITE_BATCH_SIZE) {
    const chunk = writes.slice(cursor, cursor + WRITE_BATCH_SIZE);
    const batch = db.batch();
    for (const candidate of chunk) {
      batch.create(db.collection("pos_orders").doc(candidate.id), candidate.value);
    }
    await batch.commit();
    console.log(`[write] ${Math.min(cursor + chunk.length, writes.length)}/${writes.length}`);
  }
};

run().catch((error) => {
  console.error(
    "[backfillJoyworldPosOrders]",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
