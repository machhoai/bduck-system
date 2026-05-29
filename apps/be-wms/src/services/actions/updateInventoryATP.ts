/**
 * UPDATE_INVENTORY_ATP — Standalone Inventory Action
 *
 * Atomically adds actual_quantity from import voucher items
 * to the warehouse inventory using Firestore Transaction.
 *
 * Called directly by importVoucherService.completeReceiving()
 * (no registry lookup needed).
 *
 * ATP Formula: total_quantity = atp_quantity + on_hold + in_transit + quarantine
 * Only atp_quantity is increased during import receiving.
 *
 * IDEMPOTENCY: Checks if this instance already executed ATP update
 * by verifying a flag on the voucher document.
 *
 * FIRESTORE TRANSACTION RULE:
 * All reads MUST execute before any writes. This handler uses a
 * 2-phase transaction: Phase 1 reads all inventory records,
 * Phase 2 writes all creates/updates.
 */

import { db } from "../../config/firebase.js";
import { AuditAction } from "@bduck/shared-types";
import type { Inventory } from "@bduck/shared-types";
import { logAudit } from "../auditService.js";
import { randomUUID } from "crypto";

/** Context passed from the calling service */
export interface SystemActionContext {
  instanceId: string;
  entityPayload: Record<string, unknown>;
  userId: string;
}

/** Result returned to the calling service */
export type SystemActionResult = Record<string, unknown>;

/** Validated item ready for inventory update */
interface ValidItem {
  productId: string;
  locationId: string;
  actualQty: number;
}

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

  // Pre-validate items outside the transaction
  const rawItems = itemsSnap.docs.map((d) => d.data());
  const validItems: ValidItem[] = [];
  const skippedItems: string[] = [];

  for (const item of rawItems) {
    const productId = item.product_id as string;
    const locationId = item.warehouse_location_id as string | null;
    const actualQty = (item.actual_quantity as number) || 0;

    if (actualQty <= 0) {
      skippedItems.push(`${productId} (qty=0)`);
      continue;
    }
    if (!locationId) {
      skippedItems.push(`${productId} (no location_id)`);
      console.warn(
        `[updateInventoryATP] Item product_id=${productId} has null warehouse_location_id. Skipping.`,
      );
      continue;
    }
    validItems.push({ productId, locationId, actualQty });
  }

  if (validItems.length === 0) {
    throw new Error(
      `[updateInventoryATP] All ${rawItems.length} items were skipped ` +
        `(reasons: ${skippedItems.join(", ")}). No inventory records created.`,
    );
  }

  console.log(
    `[updateInventoryATP] Processing ${validItems.length} valid items for voucher ${voucherId} (warehouse: ${warehouseId})`,
  );

  // ══════════════════════════════════════════════════════════════
  // 2-PHASE TRANSACTION (Firestore rule: all reads before writes)
  // ══════════════════════════════════════════════════════════════
  let totalUpdated = 0;

  await db.runTransaction(async (txn) => {
    // ── PHASE 1: READ all existing inventory records ──
    const inventoryQueries = validItems.map((vi) =>
      db
        .collection("inventory")
        .where("warehouse_id", "==", warehouseId)
        .where("warehouse_location_id", "==", vi.locationId)
        .where("product_id", "==", vi.productId)
        .limit(1),
    );

    // Execute ALL reads first
    const inventorySnapshots = await Promise.all(
      inventoryQueries.map((q) => txn.get(q)),
    );

    // ── PHASE 2: WRITE all creates/updates ──
    const now = new Date();

    for (let i = 0; i < validItems.length; i++) {
      const vi = validItems[i];
      const invSnap = inventorySnapshots[i];

      if (invSnap.empty) {
        // Create new inventory record
        const newId = randomUUID();
        const newRef = db.collection("inventory").doc(newId);
        const record: Inventory = {
          id: newId,
          warehouse_id: warehouseId,
          warehouse_location_id: vi.locationId,
          product_id: vi.productId,
          atp_quantity: vi.actualQty,
          on_hold_quantity: 0,
          in_transit_quantity: 0,
          quarantine_quantity: 0,
          total_quantity: vi.actualQty,
          last_count_at: null,
          last_updated_at: now,
          is_deleted: false,
        };
        txn.set(newRef, record);
      } else {
        // Update existing — increment atp_quantity + total_quantity
        const existing = invSnap.docs[0].data() as Inventory;
        const docRef = db.collection("inventory").doc(existing.id);
        const newAtp = existing.atp_quantity + vi.actualQty;
        const newOnHold = existing.on_hold_quantity;
        const newInTransit = existing.in_transit_quantity;
        const newQuarantine = existing.quarantine_quantity;

        txn.update(docRef, {
          atp_quantity: newAtp,
          total_quantity: newAtp + newOnHold + newInTransit + newQuarantine,
          last_updated_at: now,
        });
      }

      totalUpdated++;
    }

    // Mark voucher as ATP-updated (idempotency flag)
    txn.update(db.collection("import_vouchers").doc(voucherId), {
      atp_updated: true,
      updated_at: now,
    });
  });

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

