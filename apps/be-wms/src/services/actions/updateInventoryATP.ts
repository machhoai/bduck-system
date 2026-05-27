/**
 * UPDATE_INVENTORY_ATP — System Action Handler
 *
 * Atomically adds actual_quantity from import voucher items
 * to the warehouse inventory using Firestore Transaction.
 *
 * ctx.entityPayload must contain { voucher_id }
 * The handler reads import_voucher items to get actual_quantity per product.
 *
 * ATP Formula: total_quantity = atp_quantity + on_hold + in_transit + quarantine
 * Only atp_quantity is increased during import receiving.
 *
 * IDEMPOTENCY: Checks if this instance already executed ATP update
 * by verifying a flag on the voucher document.
 */

import { db } from "../../config/firebase.js";
import { AuditAction } from "@bduck/shared-types";
import { logAudit } from "../auditService.js";
import type {
  SystemActionContext,
  SystemActionResult,
} from "../systemActionRegistry.js";

export async function updateInventoryATP(
  _params: Record<string, unknown>,
  ctx: SystemActionContext,
): Promise<SystemActionResult> {
  const voucherId = ctx.entityPayload.voucher_id as string;
  if (!voucherId) {
    return { skipped: true, reason: "missing_voucher_id" };
  }

  // Read voucher items
  const itemsSnap = await db
    .collection("import_vouchers")
    .doc(voucherId)
    .collection("items")
    .where("is_deleted", "==", false)
    .get();

  if (itemsSnap.empty) {
    return { skipped: true, reason: "no_items_found" };
  }

  const voucherSnap = await db.collection("import_vouchers").doc(voucherId).get();
  if (!voucherSnap.exists) {
    return { skipped: true, reason: "voucher_not_found" };
  }

  const voucher = voucherSnap.data()!;
  const warehouseId = voucher.warehouse_id as string;

  // Idempotency: check if ATP was already updated for this voucher
  if (voucher.atp_updated === true) {
    return { skipped: true, reason: "atp_already_updated" };
  }

  // Build item list
  const items = itemsSnap.docs.map((d) => d.data());
  let totalUpdated = 0;

  // Transaction: update inventory for each item atomically
  await db.runTransaction(async (txn) => {
    for (const item of items) {
      const productId = item.product_id as string;
      const locationId = item.warehouse_location_id as string;
      const actualQty = (item.actual_quantity as number) || 0;

      if (actualQty <= 0) continue;

      // Find or create inventory record for this product+location pair
      const invQuery = db
        .collection("inventory")
        .where("warehouse_id", "==", warehouseId)
        .where("warehouse_location_id", "==", locationId)
        .where("product_id", "==", productId)
        .limit(1);

      const invSnap = await txn.get(invQuery);
      const now = new Date();

      if (invSnap.empty) {
        // Create new inventory record
        const newRef = db.collection("inventory").doc();
        txn.set(newRef, {
          id: newRef.id,
          warehouse_id: warehouseId,
          warehouse_location_id: locationId,
          product_id: productId,
          total_quantity: actualQty,
          atp_quantity: actualQty,
          on_hold_quantity: 0,
          in_transit_quantity: 0,
          quarantine_quantity: 0,
          last_count_at: null,
          last_updated_at: now,
        });
      } else {
        // Update existing inventory
        const invDoc = invSnap.docs[0];
        const invData = invDoc.data();
        const newAtp = (invData.atp_quantity as number) + actualQty;
        const newTotal = (invData.total_quantity as number) + actualQty;

        txn.update(invDoc.ref, {
          atp_quantity: newAtp,
          total_quantity: newTotal,
          last_updated_at: now,
        });
      }

      totalUpdated++;
    }

    // Mark voucher as ATP-updated (idempotency flag)
    txn.update(db.collection("import_vouchers").doc(voucherId), {
      atp_updated: true,
      updated_at: new Date(),
    });
  });

  // Audit trail
  await logAudit({
    entity_type: "IMPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: warehouseId,
    action: AuditAction.UPDATE,
    user_id: ctx.userId,
    old_value: null,
    new_value: {
      action: "UPDATE_INVENTORY_ATP",
      items_updated: totalUpdated,
      warehouse_id: warehouseId,
    },
  });

  return { items_updated: totalUpdated, warehouse_id: warehouseId };
}
