import {
  calculateInventoryTotalQuantity,
  type Inventory,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";
import * as inventoryRepo from "../repositories/inventoryRepository.js";

export const upsertStock = async (
  transaction: FirebaseFirestore.Transaction,
  warehouseId: string,
  warehouseLocationId: string,
  productId: string,
  deltas: {
    atp_quantity?: number;
    on_hold_quantity?: number;
    in_transit_quantity?: number;
    quarantine_quantity?: number;
  },
): Promise<void> => {
  await inventoryRepo.upsertQuantityInTransaction(
    transaction,
    warehouseId,
    warehouseLocationId,
    productId,
    deltas,
    randomUUID(),
  );
};

export const deductAtp = async (
  transaction: FirebaseFirestore.Transaction,
  warehouseLocationId: string,
  productId: string,
  quantity: number,
): Promise<void> => {
  const query = db
    .collection("inventory")
    .where("warehouse_location_id", "==", warehouseLocationId)
    .where("product_id", "==", productId)
    .limit(5);
  const snapshot = await transaction.get(query);
  const activeDocuments = snapshot.docs.filter(
    (document) => document.data().is_deleted !== true,
  );
  if (activeDocuments.length === 0) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không tìm thấy tồn kho cho sản phẩm tại vị trí này.",
        zh: "在该库位未找到该产品的库存记录。",
      },
    };
  }

  const existing = activeDocuments[0].data() as Inventory;
  const nextAtp = existing.atp_quantity - quantity;
  if (nextAtp < 0) {
    throw {
      statusCode: 400,
      messages: {
        vi: `Số lượng khả dụng (ATP) không đủ. Hiện tại: ${existing.atp_quantity}, yêu cầu: ${quantity}.`,
        zh: `可用数量 (ATP) 不足。当前：${existing.atp_quantity}，请求：${quantity}。`,
      },
    };
  }

  transaction.update(db.collection("inventory").doc(existing.id), {
    atp_quantity: nextAtp,
    total_quantity: calculateInventoryTotalQuantity({
      atp_quantity: nextAtp,
      on_hold_quantity: existing.on_hold_quantity,
      in_transit_quantity: existing.in_transit_quantity,
      quarantine_quantity: existing.quarantine_quantity,
    }),
    last_updated_at: new Date(),
  });
};
