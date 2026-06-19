/**
 * DEDUCT_INVENTORY_ATP — Standalone Inventory Action for Export Vouchers
 *
 * ═══════════════════════════════════════════════════════════════
 * Atomically deducts picked_quantity from export voucher items
 * out of warehouse inventory using Firestore Transaction.
 *
 * HARD BLOCK: If ANY item would result in ATP < 0, the ENTIRE
 * transaction is rolled back. No partial deductions allowed.
 *
 * 2-PHASE TRANSACTION (Firestore rule: all reads before writes):
 * Phase 1: Read all inventory records + validate ATP sufficiency
 * Phase 2: Write all deductions + mark voucher atp_deducted=true
 *
 * TRANSFER SUPPORT:
 * If the export voucher is linked to a transfer order (reference_type = 'TRANSFER_ORDER'),
 * the deducted quantity is moved to in_transit_quantity instead of simply removed.
 *
 * IDEMPOTENCY: Checks voucher.atp_deducted flag before executing.
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../../config/firebase.js";
import {
  AuditAction,
  calculateInventoryTotalQuantity,
} from "@bduck/shared-types";
import type { Inventory } from "@bduck/shared-types";
import { logAudit } from "../auditService.js";

/** Item validated and ready for deduction */
interface DeductItem {
  productId: string;
  locationId: string;
  pickedQty: number;
}

/**
 * Deduct ATP for all items in an export voucher.
 * Called by exportVoucherService.completePicking().
 *
 * @throws 400 if any item would result in negative ATP
 */
export async function deductInventoryATP(
  voucherId: string,
  userId: string,
): Promise<{ items_deducted: number }> {
  console.log(`[deductInventoryATP] ▶ Starting for voucher ${voucherId}`);

  // Read voucher
  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();

  if (!voucherSnap.exists) {
    throw Object.assign(new Error("Voucher not found"), {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy phiếu xuất kho.",
        zh: "未找到出库单。",
      },
    });
  }

  const voucher = voucherSnap.data()!;

  // Idempotency check
  if (voucher.atp_deducted === true) {
    console.log(`[deductInventoryATP] ⏭ Skipping — already deducted for ${voucherId}`);
    return { items_deducted: 0 };
  }

  const warehouseId = voucher.warehouse_id as string;

  // Check if this export is linked to a transfer order
  const isTransferExport = voucher.reference_type === "TRANSFER_ORDER";
  console.log(`[deductInventoryATP] warehouseId=${warehouseId}, isTransferExport=${isTransferExport}`);

  // Read voucher items
  const itemsSnap = await voucherRef
    .collection("items")
    .where("is_deleted", "==", false)
    .get();

  if (itemsSnap.empty) {
    throw Object.assign(new Error("No items"), {
      statusCode: 400,
      messages: {
        vi: "Phiếu xuất không có sản phẩm nào.",
        zh: "出库单没有产品。",
      },
    });
  }

  // Validate items and log picked quantities
  const deductItems: DeductItem[] = [];
  console.log(`[deductInventoryATP] Found ${itemsSnap.docs.length} items in voucher`);

  for (const doc of itemsSnap.docs) {
    const item = doc.data();
    const pickedQty = (item.picked_quantity as number) || 0;
    const requestedQty = (item.quantity as number) || 0;

    console.log(
      `[deductInventoryATP]   Item ${doc.id}: product=${item.product_id}, ` +
      `requested=${requestedQty}, picked=${pickedQty}`,
    );

    if (pickedQty <= 0) {
      console.warn(`[deductInventoryATP]   ⚠ Skipping item ${doc.id} — picked_quantity=0`);
      continue;
    }

    deductItems.push({
      productId: item.product_id as string,
      locationId: item.warehouse_location_id as string,
      pickedQty,
    });
  }

  if (deductItems.length === 0) {
    console.error(`[deductInventoryATP] ❌ All items have picked_quantity=0! Cannot deduct.`);
    throw Object.assign(new Error("No picked items"), {
      statusCode: 400,
      messages: {
        vi: "Chưa có sản phẩm nào được soạn (picked_quantity = 0).",
        zh: "没有已拣选的产品（picked_quantity = 0）。",
      },
    });
  }

  console.log(`[deductInventoryATP] ${deductItems.length} items ready for deduction`);

  // ══════════════════════════════════════════════════════════════
  // 2-PHASE TRANSACTION — HARD BLOCK on negative ATP
  // ══════════════════════════════════════════════════════════════
  let totalDeducted = 0;

  await db.runTransaction(async (txn) => {
    // ── PHASE 1: READ all inventory records ──
    const queries = deductItems.map((di) =>
      db
        .collection("inventory")
        .where("warehouse_id", "==", warehouseId)
        .where("warehouse_location_id", "==", di.locationId)
        .where("product_id", "==", di.productId)
        .limit(5),
    );

    const rawSnapshots = await Promise.all(queries.map((q) => txn.get(q)));
    // Filter out soft-deleted records client-side (avoids composite index requirement)
    const snapshots = rawSnapshots.map((snap) => {
      const activeDocs = snap.docs.filter((d) => d.data().is_deleted !== true);
      return { ...snap, empty: activeDocs.length === 0, docs: activeDocs };
    });

    // Validate ALL items BEFORE writing anything
    const updates: Array<{
      ref: FirebaseFirestore.DocumentReference;
      existing: Inventory;
      newAtp: number;
      deductQty: number;
    }> = [];

    for (let i = 0; i < deductItems.length; i++) {
      const di = deductItems[i];
      const invSnap = snapshots[i];

      if (invSnap.empty) {
        console.error(
          `[deductInventoryATP] ❌ No inventory record for product=${di.productId}, ` +
          `location=${di.locationId}, warehouse=${warehouseId}`,
        );
        throw Object.assign(new Error("Inventory not found"), {
          statusCode: 400,
          messages: {
            vi: `Không tìm thấy tồn kho cho sản phẩm ${di.productId} tại vị trí ${di.locationId}.`,
            zh: `在库位 ${di.locationId} 未找到产品 ${di.productId} 的库存。`,
          },
        });
      }

      // Use Firestore document reference directly from the query result
      const invDoc = invSnap.docs[0];
      const existing = invDoc.data() as Inventory;
      const newAtp = existing.atp_quantity - di.pickedQty;

      console.log(
        `[deductInventoryATP]   Inventory ${invDoc.id}: ` +
        `currentATP=${existing.atp_quantity}, deduct=${di.pickedQty}, newATP=${newAtp}, ` +
        `in_transit=${existing.in_transit_quantity}`,
      );

      // ── HARD BLOCK: Negative ATP prevention ──
      if (newAtp < 0) {
        throw Object.assign(new Error("Insufficient ATP"), {
          statusCode: 400,
          messages: {
            vi: `Không đủ tồn kho khả dụng để xuất hàng. Sản phẩm: ${di.productId}, ATP hiện tại: ${existing.atp_quantity}, Yêu cầu: ${di.pickedQty}.`,
            zh: `可用库存不足。产品：${di.productId}，当前ATP：${existing.atp_quantity}，请求：${di.pickedQty}。`,
          },
        });
      }

      updates.push({
        ref: invDoc.ref, // Use doc.ref directly — guaranteed correct reference
        existing,
        newAtp,
        deductQty: di.pickedQty,
      });
    }

    // ── PHASE 2: WRITE all deductions ──
    const now = new Date();

    for (let i = 0; i < updates.length; i++) {
      const { ref, existing, newAtp, deductQty } = updates[i];

      // For transfer exports: move deducted amount to in_transit
      // For regular exports: simply remove from ATP (goods leave warehouse)
      const newInTransit = isTransferExport
        ? existing.in_transit_quantity + deductQty
        : existing.in_transit_quantity;

      const newTotal = calculateInventoryTotalQuantity({
        atp_quantity: newAtp,
        on_hold_quantity: existing.on_hold_quantity,
        in_transit_quantity: newInTransit,
        quarantine_quantity: existing.quarantine_quantity,
      });

      const updatePayload: Record<string, unknown> = {
        atp_quantity: newAtp,
        total_quantity: newTotal,
        last_updated_at: now,
      };

      // Only write in_transit_quantity if this is a transfer
      if (isTransferExport) {
        updatePayload.in_transit_quantity = newInTransit;
      }

      console.log(
        `[deductInventoryATP]   WRITE ${ref.id}: ` +
        `atp=${newAtp}, in_transit=${newInTransit}, total=${newTotal}`,
      );

      txn.update(ref, updatePayload);
      totalDeducted++;
    }

    // Mark voucher as ATP-deducted (idempotency)
    txn.update(voucherRef, {
      atp_deducted: true,
      updated_at: now,
    });

    console.log(`[deductInventoryATP] ✅ Transaction committed: ${totalDeducted} items deducted`);
  });

  // Audit trail (outside transaction for reliability)
  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: warehouseId,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: null,
    new_value: {
      action: "DEDUCT_INVENTORY_ATP",
      items_deducted: totalDeducted,
      is_transfer_export: isTransferExport,
      warehouse_id: warehouseId,
    },
  });

  console.log(
    `[deductInventoryATP] ✅ Completed: ${totalDeducted} items deducted for voucher ${voucherId}` +
    (isTransferExport ? " (transfer → in_transit incremented)" : ""),
  );

  return { items_deducted: totalDeducted };
}
