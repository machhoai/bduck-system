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
 *
 * ARCHITECTURE (v2):
 * Uses inventoryRepository.upsertQuantityInTransaction() to ensure
 * consistent record shape (is_deleted, total_quantity recalc, etc.)
 */

import { db } from "../../config/firebase.js";
import { AuditAction } from "@bduck/shared-types";
import { logAudit } from "../auditService.js";
import * as inventoryRepo from "../../repositories/inventoryRepository.js";
import type {
  SystemActionContext,
  SystemActionResult,
} from "../systemActionRegistry.js";
import { randomUUID } from "crypto";

export async function updateInventoryATP(
  _params: Record<string, unknown>,
  ctx: SystemActionContext,
): Promise<SystemActionResult> {
  const voucherId = ctx.entityPayload.voucher_id as string;
  if (!voucherId) {
    return { skipped: true, reason: "missing_voucher_id" };
  }

  // Read voucher document
  const voucherSnap = await db.collection("import_vouchers").doc(voucherId).get();
  if (!voucherSnap.exists) {
    throw new Error(
      `[updateInventoryATP] Voucher ${voucherId} not found in Firestore.`,
    );
  }

  const voucher = voucherSnap.data()!;
  const warehouseId = voucher.warehouse_id as string;

  if (!warehouseId) {
    throw new Error(
      `[updateInventoryATP] Voucher ${voucherId} has no warehouse_id.`,
    );
  }

  // Idempotency: check if ATP was already updated for this voucher
  if (voucher.atp_updated === true) {
    console.log(
      `[updateInventoryATP] Skipping — ATP already updated for voucher ${voucherId}.`,
    );
    return { skipped: true, reason: "atp_already_updated" };
  }

  // Read voucher items
  const itemsSnap = await db
    .collection("import_vouchers")
    .doc(voucherId)
    .collection("items")
    .where("is_deleted", "==", false)
    .get();

  if (itemsSnap.empty) {
    throw new Error(
      `[updateInventoryATP] No items found for voucher ${voucherId}. ` +
        `Cannot update inventory without items.`,
    );
  }

  const items = itemsSnap.docs.map((d) => d.data());
  let totalUpdated = 0;
  const skippedItems: string[] = [];

  console.log(
    `[updateInventoryATP] Processing ${items.length} items for voucher ${voucherId} (warehouse: ${warehouseId})`,
  );

  // Transaction: update inventory for each item atomically
  await db.runTransaction(async (txn) => {
    for (const item of items) {
      const productId = item.product_id as string;
      const locationId = item.warehouse_location_id as string | null;
      const actualQty = (item.actual_quantity as number) || 0;

      if (actualQty <= 0) {
        skippedItems.push(`${productId} (qty=0)`);
        continue;
      }

      if (!locationId) {
        // warehouse_location_id is required for inventory tracking
        skippedItems.push(`${productId} (no location_id)`);
        console.warn(
          `[updateInventoryATP] Item product_id=${productId} has null warehouse_location_id. Skipping.`,
        );
        continue;
      }

      // Use repository pattern — consistent record shape with is_deleted, total_quantity recalc
      await inventoryRepo.upsertQuantityInTransaction(
        txn,
        warehouseId,
        locationId,
        productId,
        { atp_quantity: actualQty },
        randomUUID(),
      );

      totalUpdated++;
    }

    // Mark voucher as ATP-updated (idempotency flag)
    txn.update(db.collection("import_vouchers").doc(voucherId), {
      atp_updated: true,
      updated_at: new Date(),
    });
  });

  if (totalUpdated === 0 && skippedItems.length > 0) {
    throw new Error(
      `[updateInventoryATP] All ${items.length} items were skipped ` +
        `(reasons: ${skippedItems.join(", ")}). No inventory records created.`,
    );
  }

  console.log(
    `[updateInventoryATP] ✅ Updated ${totalUpdated} inventory records for voucher ${voucherId}` +
      (skippedItems.length > 0
        ? ` (${skippedItems.length} skipped: ${skippedItems.join(", ")})`
        : ""),
  );

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
      items_skipped: skippedItems.length,
      warehouse_id: warehouseId,
    },
  });

  return { items_updated: totalUpdated, warehouse_id: warehouseId };
}

