import type { TransferOrderItem } from "@bduck/shared-types";
import type { CompleteReceivingInput } from "./transferOrderReceivingService.js";
import { createTransferError } from "./transferOrderSupport.js";

export interface ReceivingItemRecord {
  receivedItem: CompleteReceivingInput["items"][number];
  transferItem: TransferOrderItem;
  ref: FirebaseFirestore.DocumentReference;
}

export const buildReceivingItems = (
  orderId: string,
  destinationFacilityId: string,
  input: CompleteReceivingInput,
  itemDocuments: readonly FirebaseFirestore.QueryDocumentSnapshot[],
  locationDocuments: readonly FirebaseFirestore.DocumentSnapshot[],
): ReceivingItemRecord[] => {
  for (const locationDocument of locationDocuments) {
    const location = locationDocument.data();
    if (
      !locationDocument.exists ||
      location?.is_deleted !== false ||
      location?.status !== "ACTIVE" ||
      location?.warehouse_id !== destinationFacilityId
    ) {
      throw createTransferError(
        400,
        "Vị trí nhận hàng không thuộc cơ sở đích.",
        "收货库位不属于目标设施。",
      );
    }
  }

  const activeItems = new Map(
    itemDocuments.map((document) => [
      document.id,
      {
        ref: document.ref,
        transferItem: document.data() as TransferOrderItem,
      },
    ]),
  );
  if (activeItems.size !== input.items.length) {
    throw createTransferError(
      400,
      "Phải kiểm nhận đầy đủ mọi dòng hàng của phiếu điều chuyển.",
      "必须验收调拨单的全部商品行。",
    );
  }

  return input.items.map((receivedItem) => {
    const record = activeItems.get(receivedItem.item_id);
    if (
      !record ||
      record.transferItem.is_deleted !== false ||
      record.transferItem.transfer_order_id !== orderId
    ) {
      throw createTransferError(
        400,
        "Dòng hàng nhận không thuộc phiếu điều chuyển.",
        "收货商品行不属于该调拨单。",
      );
    }
    return { receivedItem, ...record };
  });
};
