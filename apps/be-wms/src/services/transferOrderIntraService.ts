import {
  AuditAction,
  TransferItemStatus,
  TransferOrderStatus,
  TransferType,
  calculateInventoryTotalQuantity,
  type Inventory,
  type TransferOrder,
  type TransferOrderItem,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";
import { logAudit } from "./auditService.js";
import type { CreateTransferOrderInput } from "./transferOrderSchemas.js";
import { createTransferError } from "./transferOrderSupport.js";

type TransferOrderWrite = TransferOrder & {
  items?: TransferOrderItem[];
  items_count?: number;
  total_quantity?: number;
  inventory_moved?: boolean;
  completed_at?: Date;
};

export async function executeIntraTransfer(
  orderId: string,
  orderNumber: string,
  input: CreateTransferOrderInput,
  userId: string,
  actionTime: Date,
  now: Date,
  configSnapshot: TransferOrder["config_snapshot"],
): Promise<TransferOrder> {
  const orderItems: TransferOrderItem[] = input.items.map((item) => ({
    id: randomUUID(),
    transfer_order_id: orderId,
    product_id: item.product_id,
    source_location_id: item.source_location_id,
    destination_location_id: item.destination_location_id ?? null,
    quantity: item.quantity,
    received_quantity: item.quantity,
    status: TransferItemStatus.COMPLETED,
    is_deleted: false,
  }));
  const totalQuantity = orderItems.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

  // Execute in a Firestore Transaction for atomicity
  const order = await db.runTransaction(async (txn) => {
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
        deltaQuantity: number;
        outgoingQuantity: number;
      }
    >();

    const addInventoryDelta = (
      warehouseId: string,
      locationId: string,
      productId: string,
      deltaQuantity: number,
      outgoingQuantity = 0,
    ) => {
      const key = inventoryKey(warehouseId, locationId, productId);
      const existing = inventoryDeltas.get(key) ?? {
        warehouseId,
        locationId,
        productId,
        deltaQuantity: 0,
        outgoingQuantity: 0,
      };

      existing.deltaQuantity += deltaQuantity;
      existing.outgoingQuantity += outgoingQuantity;
      inventoryDeltas.set(key, existing);
    };

    for (const item of input.items) {
      addInventoryDelta(
        input.source_warehouse_id,
        item.source_location_id,
        item.product_id,
        -item.quantity,
        item.quantity,
      );
      addInventoryDelta(
        input.destination_warehouse_id,
        item.destination_location_id!,
        item.product_id,
        item.quantity,
      );
    }

    const inventoryEntries = Array.from(inventoryDeltas.values());
    const inventorySnapshots = await Promise.all(
      inventoryEntries.map((entry) =>
        txn.get(
          db
            .collection("inventory")
            .where("warehouse_id", "==", entry.warehouseId)
            .where("warehouse_location_id", "==", entry.locationId)
            .where("product_id", "==", entry.productId)
            .limit(1),
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

    // 1. Validate ATP after all reads and before any writes.
    for (const entry of inventoryEntries) {
      if (entry.outgoingQuantity <= 0) continue;

      const activeRecord = activeInventory.get(
        inventoryKey(entry.warehouseId, entry.locationId, entry.productId),
      );
      const currentAtp = activeRecord?.data.atp_quantity ?? 0;

      if (currentAtp < entry.outgoingQuantity) {
        throw createTransferError(
          400,
          `Không đủ tồn kho khả dụng (ATP: ${currentAtp}, Yêu cầu: ${entry.outgoingQuantity}).`,
          `可用库存不足 (ATP: ${currentAtp}, 请求: ${entry.outgoingQuantity})。`,
        );
      }
    }

    // 2. Move inventory after every inventory read has completed.
    for (const entry of inventoryEntries) {
      if (entry.deltaQuantity === 0) continue;

      const activeRecord = activeInventory.get(
        inventoryKey(entry.warehouseId, entry.locationId, entry.productId),
      );

      if (activeRecord) {
        const newAtp = activeRecord.data.atp_quantity + entry.deltaQuantity;
        const newTotal = calculateInventoryTotalQuantity({
          atp_quantity: newAtp,
          on_hold_quantity: activeRecord.data.on_hold_quantity,
          in_transit_quantity: activeRecord.data.in_transit_quantity,
          quarantine_quantity: activeRecord.data.quarantine_quantity,
        });

        if (newAtp < 0 || newTotal < 0) {
          throw createTransferError(
            400,
            "Tồn kho sau điều chuyển không hợp lệ.",
            "调拨后库存无效。",
          );
        }

        txn.update(activeRecord.ref, {
          atp_quantity: newAtp,
          total_quantity: newTotal,
          last_updated_at: now,
        });
      } else {
        if (entry.deltaQuantity < 0) {
          throw createTransferError(
            400,
            "Không tìm thấy tồn kho nguồn để điều chuyển.",
            "找不到可用的源库存。",
          );
        }

        const newInvId = randomUUID();
        txn.set(db.collection("inventory").doc(newInvId), {
          id: newInvId,
          warehouse_id: entry.warehouseId,
          warehouse_location_id: entry.locationId,
          product_id: entry.productId,
          atp_quantity: entry.deltaQuantity,
          on_hold_quantity: 0,
          in_transit_quantity: 0,
          quarantine_quantity: 0,
          total_quantity: calculateInventoryTotalQuantity({
            atp_quantity: entry.deltaQuantity,
            on_hold_quantity: 0,
            in_transit_quantity: 0,
            quarantine_quantity: 0,
          }),
          last_count_at: null,
          last_updated_at: now,
          is_deleted: false,
        });
      }
    }

    // 3. Create transfer order (status=COMPLETED)
    const transferOrder: TransferOrderWrite = {
      id: orderId,
      order_number: orderNumber,
      transfer_type: TransferType.INTRA_WAREHOUSE,
      source_warehouse_id: input.source_warehouse_id,
      destination_warehouse_id: input.destination_warehouse_id,
      status: TransferOrderStatus.COMPLETED,
      creator_id: userId,
      approver_id: "SYSTEM_AUTO_APPROVE",
      approved_at: now,
      export_voucher_id: null,
      received_by: userId,
      received_at: now,
      dispatched_at: now,
      attachment_urls: input.attachment_urls ?? [],
      config_snapshot: configSnapshot,
      requires_reauth: false,
      reauth_confirmed_by: null,
      reauth_confirmed_at: null,
      action_time: actionTime,
      sync_time: now,
      notes: input.notes ?? null,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      completed_at: now,
      inventory_moved: true,
      items_count: orderItems.length,
      total_quantity: totalQuantity,
      items: orderItems,
    };
    txn.set(db.collection("transfer_orders").doc(orderId), transferOrder);

    // 4. Create items
    for (const item of orderItems) {
      txn.set(
        db
          .collection("transfer_orders")
          .doc(orderId)
          .collection("items")
          .doc(item.id),
        item,
      );
    }

    return transferOrder;
  });

  // Audit log (outside transaction)
  await logAudit({
    entity_type: "TRANSFER_INTRA",
    entity_id: orderId,
    warehouse_id: order.source_warehouse_id,
    action: AuditAction.TRANSFER,
    user_id: userId,
    old_value: null,
    new_value: {
      order_number: orderNumber,
      status: TransferOrderStatus.COMPLETED,
      items_count: input.items.length,
    },
  });

  return order;
}

// ─────────────────────────────────────────────
// STATE MACHINE — Approval Callbacks
// ─────────────────────────────────────────────

/**
 * Called when all approval levels are completed.
 * Advances INTER transfer: APPROVED → create Export Voucher (if auto) or EXPORT_PENDING.
 */
