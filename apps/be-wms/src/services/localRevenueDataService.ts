import { posInvoiceOrderRepository } from "../repositories/posInvoiceOrderRepository.js";
import { fetchRevenueProductGroups } from "../repositories/revenueProductRepository.js";

import {
  buildLocalRevenuePeriod,
  type RevenuePeriodData,
} from "./localRevenuePeriodBuilder.js";
import {
  toVietnamIsoRange,
  type RevenueDateRange,
} from "./revenueDateRange.js";

export type { RevenuePeriodData } from "./localRevenuePeriodBuilder.js";

export async function loadLocalRevenuePeriod(
  warehouseId: string | readonly string[],
  range: RevenueDateRange,
): Promise<RevenuePeriodData> {
  const { startIso, endExclusiveIso } = toVietnamIsoRange(range);
  const warehouseIds = [
    ...new Set(typeof warehouseId === "string" ? [warehouseId] : warehouseId),
  ];
  const sourceOrders = [];
  // Bound Firestore concurrency for users managing many stores.
  for (let index = 0; index < warehouseIds.length; index += 5) {
    const batches = await Promise.all(
      warehouseIds
        .slice(index, index + 5)
        .map((id) =>
          posInvoiceOrderRepository.listPaidForDate(
            id,
            startIso,
            endExclusiveIso,
          ),
        ),
    );
    sourceOrders.push(...batches.flat());
  }
  const groups = sourceOrders.length ? await fetchRevenueProductGroups() : {};
  return buildLocalRevenuePeriod(sourceOrders, range, groups);
}

export async function loadLocalTaxByDate(
  warehouseId: string,
  range: RevenueDateRange,
): Promise<Record<string, number>> {
  const period = await loadLocalRevenuePeriod(warehouseId, range);
  return Object.fromEntries(
    period.dailyRows.map((row) => [row.date, row.totalTax]),
  );
}
