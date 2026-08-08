import type { MeInvoiceStoreConfig } from "@bduck/shared-types";
import {
  invoiceOrderRepository,
  invoiceSourceOrderDocumentId,
  type SourceOrderWrite,
  type SourceOrderWriteResult,
} from "../repositories/invoiceOrderRepository.js";
import {
  posInvoiceOrderRepository,
  type PosInvoiceOrderRecord,
} from "../repositories/posInvoiceOrderRepository.js";
import type {
  StoredMeInvoiceAccount,
} from "../repositories/meInvoiceConfigRepository.js";
import { ensureInitialInvoiceDocument } from "./invoiceDocumentService.js";
import {
  buildPosInvoiceSourceOrder,
  posOrderIsPaid,
} from "./invoicePosOrderAdapter.js";
import { sourceOrderIsInvoiceEligible } from "./invoiceReconciliationPolicy.js";

const vietnamDateRange = (businessDate: string) => {
  const start = new Date(`${businessDate}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1_000);
  return { startIso: start.toISOString(), endIso: end.toISOString() };
};

export interface PosOrderSyncResult extends SourceOrderWriteResult {
  writes: SourceOrderWrite[];
  orders: PosInvoiceOrderRecord[];
  draft_created_count: number;
}

export const syncPosInvoiceOrdersForDate = async (input: {
  warehouseId: string;
  businessDate: string;
  runId: string;
  storeConfig: MeInvoiceStoreConfig | null;
  account: StoredMeInvoiceAccount | null;
  actorId: string;
  createDrafts: boolean;
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
      .filter((value): value is string =>
        typeof value === "string" && Boolean(value),
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

  let draftCreatedCount = 0;
  if (
    input.createDrafts &&
    input.storeConfig &&
    input.account
  ) {
    for (const write of writes.filter((item) =>
      sourceOrderIsInvoiceEligible(item.projection),
    )) {
      const result = await ensureInitialInvoiceDocument(
        {
          id: invoiceSourceOrderDocumentId(
            input.warehouseId,
            write.source_order_id,
            "JPOS",
          ),
          ...write.projection,
          source_payload_hash: write.source_payload_hash,
        },
        input.storeConfig,
        input.account,
        input.actorId,
      );
      if (result?.created) draftCreatedCount += 1;
    }
  }

  return {
    ...counts,
    writes,
    orders,
    draft_created_count: draftCreatedCount,
  };
};
