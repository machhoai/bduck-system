import {
  TransferItemStatus,
  TransferOrderStatus,
  calculateInventoryTotalQuantity,
  type Inventory,
  type TransferOrder,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";
import type { AuthorizationService } from "./authorization/index.js";
import type { CompleteReceivingInput } from "./transferOrderReceivingService.js";
import { createTransferError } from "./transferOrderSupport.js";
import { assertTransferReceiveAccess } from "./transferAccessPolicy.js";
import { buildReceivingItems } from "./transferReceivingItemPolicy.js";

export async function runTransferReceivingTransaction(
  orderId: string,
  input: CompleteReceivingInput,
  order: TransferOrder,
  authorization: AuthorizationService,
  now: Date,
): Promise<void> {
  await db.runTransaction(async (txn) => {
    const orderRef = db.collection("transfer_orders").doc(orderId);
    const orderSnap = await txn.get(orderRef);
    if (!orderSnap.exists) {
      throw createTransferError(404, "Không tìm thấy phiếu.", "找不到单据。");
    }

    const currentOrder = orderSnap.data() as TransferOrder;
    if (
      currentOrder.is_deleted !== false ||
      currentOrder.source_warehouse_id !== order.source_warehouse_id ||
      currentOrder.destination_warehouse_id !== order.destination_warehouse_id
    ) {
      throw createTransferError(
        409,
        "Phạm vi phiếu điều chuyển đã thay đổi. Vui lòng thao tác lại.",
        "调拨单范围已更改，请重试。",
      );
    }
    assertTransferReceiveAccess(
      authorization,
      currentOrder.destination_warehouse_id,
    );
    if (currentOrder.status !== TransferOrderStatus.RECEIVING) {
      throw createTransferError(
        400,
        "Phiếu chưa ở trạng thái kiểm đếm.",
        "单据不在盘点状态。",
      );
    }

    const activeItemsQuery = orderRef
      .collection("items")
      .where("is_deleted", "==", false);
    const destinationLocationRefs = input.items.map((receivedItem) =>
      db
        .collection("warehouse_locations")
        .doc(receivedItem.destination_location_id),
    );
    const [activeItemsSnapshot, destinationLocationSnaps] = await Promise.all([
      txn.get(activeItemsQuery),
      Promise.all(destinationLocationRefs.map((ref) => txn.get(ref))),
    ]);
    const receivingItems = buildReceivingItems(
      orderId,
      currentOrder.destination_warehouse_id,
      input,
      activeItemsSnapshot.docs,
      destinationLocationSnaps,
    );
    const inventoryKey = (
      warehouseId: string,
      locationId: string,
      productId: string,
    ) => `${warehouseId}:${locationId}:${productId}`;

    const inventoryDeltas = new Map<
      string,
      {
        warehouseId: string;
        locationId: string;
        productId: string;
        atpDelta: number;
        inTransitDelta: number;
      }
    >();

    const addInventoryDelta = (
      warehouseId: string,
      locationId: string,
      productId: string,
      delta: { atpDelta?: number; inTransitDelta?: number },
    ) => {
      const key = inventoryKey(warehouseId, locationId, productId);
      const existing = inventoryDeltas.get(key) ?? {
        warehouseId,
        locationId,
        productId,
        atpDelta: 0,
        inTransitDelta: 0,
      };

      existing.atpDelta += delta.atpDelta ?? 0;
      existing.inTransitDelta += delta.inTransitDelta ?? 0;
      inventoryDeltas.set(key, existing);
    };

    for (const { receivedItem, transferItem } of receivingItems) {
      addInventoryDelta(
        currentOrder.source_warehouse_id,
        transferItem.source_location_id,
        transferItem.product_id,
        { inTransitDelta: -transferItem.quantity },
      );

      if (receivedItem.received_quantity > 0) {
        addInventoryDelta(
          currentOrder.destination_warehouse_id,
          receivedItem.destination_location_id,
          transferItem.product_id,
          { atpDelta: receivedItem.received_quantity },
        );
      }
    }

    const inventoryEntries = Array.from(inventoryDeltas.values()).filter(
      (entry) => entry.atpDelta !== 0 || entry.inTransitDelta !== 0,
    );
    const inventorySnapshots = await Promise.all(
      inventoryEntries.map((entry) =>
        txn.get(
          db
            .collection("inventory")
            .where("warehouse_id", "==", entry.warehouseId)
            .where("warehouse_location_id", "==", entry.locationId)
            .where("product_id", "==", entry.productId)
            .limit(5),
        ),
      ),
    );

    const activeInventory = new Map<
      string,
      { ref: FirebaseFirestore.DocumentReference; data: Inventory }
    >();

    for (let i = 0; i < inventoryEntries.length; i++) {
      const entry = inventoryEntries[i];
      const activeDoc = inventorySnapshots[i].docs.find(
        (d) => d.data().is_deleted !== true,
      );

      if (activeDoc) {
        activeInventory.set(
          inventoryKey(entry.warehouseId, entry.locationId, entry.productId),
          { ref: activeDoc.ref, data: activeDoc.data() as Inventory },
        );
      }
    }

    for (const entry of inventoryEntries) {
      const activeRecord = activeInventory.get(
        inventoryKey(entry.warehouseId, entry.locationId, entry.productId),
      );

      if (!activeRecord && entry.inTransitDelta < 0) {
        throw createTransferError(
          400,
          "Không tìm thấy tồn kho đang chuyển tại vị trí nguồn.",
          "源库位未找到在途库存。",
        );
      }

      const currentAtp = activeRecord?.data.atp_quantity ?? 0;
      const currentInTransit = activeRecord?.data.in_transit_quantity ?? 0;
      const newAtp = currentAtp + entry.atpDelta;
      const newInTransit = currentInTransit + entry.inTransitDelta;

      if (newAtp < 0 || newInTransit < 0) {
        throw createTransferError(
          400,
          "Tồn kho sau khi nhận hàng không hợp lệ.",
          "收货后的库存无效。",
        );
      }
    }

    for (const entry of inventoryEntries) {
      const activeRecord = activeInventory.get(
        inventoryKey(entry.warehouseId, entry.locationId, entry.productId),
      );

      if (activeRecord) {
        const newAtp = activeRecord.data.atp_quantity + entry.atpDelta;
        const newInTransit =
          activeRecord.data.in_transit_quantity + entry.inTransitDelta;
        const newTotal = calculateInventoryTotalQuantity({
          atp_quantity: newAtp,
          on_hold_quantity: activeRecord.data.on_hold_quantity,
          in_transit_quantity: newInTransit,
          quarantine_quantity: activeRecord.data.quarantine_quantity,
        });

        txn.update(activeRecord.ref, {
          atp_quantity: newAtp,
          in_transit_quantity: newInTransit,
          total_quantity: newTotal,
          last_updated_at: now,
        });
      } else {
        const newInvId = randomUUID();
        const record: Inventory = {
          id: newInvId,
          warehouse_id: entry.warehouseId,
          warehouse_location_id: entry.locationId,
          product_id: entry.productId,
          total_quantity: calculateInventoryTotalQuantity({
            atp_quantity: entry.atpDelta,
            on_hold_quantity: 0,
            in_transit_quantity: entry.inTransitDelta,
            quarantine_quantity: 0,
          }),
          atp_quantity: entry.atpDelta,
          on_hold_quantity: 0,
          in_transit_quantity: entry.inTransitDelta,
          quarantine_quantity: 0,
          last_count_at: null,
          last_updated_at: now,
          is_deleted: false,
        };

        txn.set(db.collection("inventory").doc(newInvId), record);
      }
    }

    for (const { receivedItem, transferItem, ref } of receivingItems) {
      const hasDiscrepancy =
        receivedItem.received_quantity !== transferItem.quantity;
      txn.update(ref, {
        destination_location_id: receivedItem.destination_location_id,
        received_quantity: receivedItem.received_quantity,
        status: hasDiscrepancy
          ? TransferItemStatus.DISCREPANCY
          : TransferItemStatus.RECEIVED,
      });
    }

    txn.update(orderRef, {
      status: TransferOrderStatus.COMPLETED,
      received_at: now,
      updated_at: now,
      sync_time: now,
    });
  });
}
