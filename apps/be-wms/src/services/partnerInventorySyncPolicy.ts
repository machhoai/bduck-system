import { createHash } from "crypto";

import type {
  PartnerInventoryComparisonRow,
  PartnerInventoryItemStatus,
  PartnerInventorySyncItemResult,
  PartnerInventorySyncRequest,
} from "@bduck/shared-types";

import type { JoyWorldStockRow } from "./partnerInventorySchemas.js";

export interface PreparedPartnerInventoryMutation {
  row: PartnerInventoryComparisonRow;
  current: JoyWorldStockRow;
  targetAtp: number;
  delta: number;
}

export const createPartnerInventoryItemResult = (
  input: PreparedPartnerInventoryMutation,
  status: PartnerInventoryItemStatus,
  partnerAfter: number | null,
  message: string | null = null,
): PartnerInventorySyncItemResult => ({
  product_id: input.row.product_id!,
  sku: input.row.sku,
  target_atp: input.targetAtp,
  partner_before: input.current.amount,
  partner_after: partnerAfter,
  delta: input.delta,
  status,
  message,
});

export const createPartnerInventoryPayloadFingerprint = (
  warehouseId: string,
  input: PartnerInventorySyncRequest,
) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        warehouseId,
        snapshotId: input.snapshot_id,
        productIds: [...new Set(input.product_ids)].sort(),
      }),
    )
    .digest("hex");

export const derivePartnerInventoryJobStatus = (
  items: PartnerInventorySyncItemResult[],
) => {
  if (items.some((item) => item.status === "UNKNOWN")) return "UNKNOWN" as const;
  const succeeded = items.filter((item) =>
    ["VERIFIED", "ALREADY_MATCHED"].includes(item.status),
  ).length;
  if (succeeded === items.length) return "COMPLETED" as const;
  return succeeded > 0 ? ("PARTIAL" as const) : ("FAILED" as const);
};

export const buildPartnerInventoryMutationItems = (
  mutations: PreparedPartnerInventoryMutation[],
  direction: "add" | "out",
) =>
  mutations.map((item) => ({
    stockId: item.current.stockId,
    giftId: item.current.giftId,
    giftNo: item.current.giftNo,
    giftName: item.current.giftName,
    amount: Math.abs(item.delta),
    giftPrice: item.current.giftPrice,
    money: (Math.abs(item.delta) * item.current.giftPrice).toFixed(2),
    remark: "",
    ...(direction === "add"
      ? { isOpenExpire: false, giftDate: null }
      : { stockValue: item.current.amount }),
  }));
