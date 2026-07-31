import {
  ENTITY_COLLECTIONS,
  type ProcessEntityType,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

export interface ApprovalEntitySnapshot {
  id: string;
  collectionName: string;
  status: string;
  creatorId: string;
  warehouseId: string;
  voucherNumber?: string;
  creatorName?: string;
  sourceWarehouseId?: string | null;
  destinationWarehouseId?: string | null;
}

const textValue = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export async function findApprovalEntity(
  entityType: ProcessEntityType,
  entityId: string,
): Promise<ApprovalEntitySnapshot | null> {
  const collectionName = ENTITY_COLLECTIONS[entityType];
  if (!collectionName) return null;

  const document = await db.collection(collectionName).doc(entityId).get();
  if (!document.exists) return null;

  const data = document.data() ?? {};
  const sourceWarehouseId = textValue(data.source_warehouse_id);
  const warehouseId = textValue(data.warehouse_id) ?? sourceWarehouseId;
  const creatorId = textValue(data.creator_id);
  const status = textValue(data.status);
  if (!warehouseId || !creatorId || !status) return null;

  return {
    id: document.id,
    collectionName,
    status,
    creatorId,
    warehouseId,
    voucherNumber:
      textValue(data.voucher_number) ?? textValue(data.order_number),
    creatorName: textValue(data.creator_name),
    sourceWarehouseId: sourceWarehouseId ?? null,
    destinationWarehouseId:
      textValue(data.destination_warehouse_id) ?? null,
  };
}
