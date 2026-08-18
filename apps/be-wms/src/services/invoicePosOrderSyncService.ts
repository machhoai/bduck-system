import type { MeInvoiceStoreConfig } from "@bduck/shared-types";

import {
  invoiceOrderRepository,
  type SourceOrderWrite,
  type SourceOrderWriteResult,
} from "../repositories/invoiceOrderRepository.js";
import type { StoredMeInvoiceAccount } from "../repositories/meInvoiceConfigRepository.js";
import {
  posInvoiceOrderRepository,
  type PosInvoiceOrderRecord,
} from "../repositories/posInvoiceOrderRepository.js";

import {
  buildPosInvoiceSourceOrder,
  posOrderIsPaid,
} from "./invoicePosOrderAdapter.js";

const vietnamDateRange = (businessDate: string) => {
  const start = new Date(`${businessDate}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1_000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

export interface PosOrderSyncResult extends SourceOrderWriteResult {
  writes: SourceOrderWrite[];
  orders: PosInvoiceOrderRecord[];
}

export const syncPosInvoiceOrdersForDate = async (input: {
  warehouseId: string;
  businessDate: string;
  runId: string;
  storeConfig: MeInvoiceStoreConfig | null;
  account: StoredMeInvoiceAccount | null;
}): Promise<PosOrderSyncResult> => {
  const range = vietnamDateRange(input.businessDate);
  const orders = (
    await posInvoiceOrderRepository.listPaidForDate(
      input.warehouseId,
      range.startIso,
      range.endIso,
    )
  ).filter(posOrderIsPaid);
  const existingSources = await invoiceOrderRepository.listOrders(
    input.warehouseId,
    input.businessDate,
  );
  const legacyJoyworldOrderNumbers = new Set(
    existingSources
      .filter((source) => source.source_system !== "JPOS")
      .map((source) => source.order_number)
      .filter(
        (value): value is string => typeof value === "string" && Boolean(value),
      ),
  );
  const writes = orders
    .filter(
      (order) =>
        !order.hkOrderNumber ||
        !legacyJoyworldOrderNumbers.has(order.hkOrderNumber),
    )
    .map((order) =>
      buildPosInvoiceSourceOrder(
        order,
        input.businessDate,
        input.storeConfig,
        input.account,
      ),
    );
  const counts = await invoiceOrderRepository.upsertOrders(
    input.warehouseId,
    input.runId,
    writes,
    new Date(),
  );

  return {
    ...counts,
    writes,
    orders,
  };
};
