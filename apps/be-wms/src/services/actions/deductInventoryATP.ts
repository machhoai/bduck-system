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
 * IDEMPOTENCY: Checks voucher.atp_deducted flag before executing.
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../../config/firebase.js";
import { AuditAction } from "@bduck/shared-types";
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
    console.log(`[deductInventoryATP] Skipping — already deducted for ${voucherId}`);
    return { items_deducted: 0 };
  }

  const warehouseId = voucher.warehouse_id as string;

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

  // Validate items
  const deductItems: DeductItem[] = [];
  for (const doc of itemsSnap.docs) {
    const item = doc.data();
    const pickedQty = (item.picked_quantity as number) || 0;
    if (pickedQty <= 0) continue;

    deductItems.push({
      productId: item.product_id as string,
      locationId: item.warehouse_location_id as string,
      pickedQty,
    });
  }

  if (deductItems.length === 0) {
    throw Object.assign(new Error("No picked items"), {
      statusCode: 400,
      messages: {
        vi: "Chưa có sản phẩm nào được soạn (picked_quantity = 0).",
        zh: "没有已拣选的产品（picked_quantity = 0）。",
      },
    });
  }

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
    }> = [];

    for (let i = 0; i < deductItems.length; i++) {
      const di = deductItems[i];
      const invSnap = snapshots[i];

      if (invSnap.empty) {
        throw Object.assign(new Error("Inventory not found"), {
          statusCode: 400,
          messages: {
            vi: `Không tìm thấy tồn kho cho sản phẩm ${di.productId} tại vị trí ${di.locationId}.`,
            zh: `在库位 ${di.locationId} 未找到产品 ${di.productId} 的库存。`,
          },
        });
      }

      const existing = invSnap.docs[0].data() as Inventory;
      const newAtp = existing.atp_quantity - di.pickedQty;

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
        ref: db.collection("inventory").doc(existing.id),
        existing,
        newAtp,
      });
    }

    // ── PHASE 2: WRITE all deductions ──
    const now = new Date();

    for (let i = 0; i < updates.length; i++) {
      const { ref, existing, newAtp } = updates[i];
      const newTotal =
        newAtp +
        existing.on_hold_quantity +
        existing.in_transit_quantity +
        existing.quarantine_quantity;

      txn.update(ref, {
        atp_quantity: newAtp,
        total_quantity: newTotal,
        last_updated_at: now,
      });

      totalDeducted++;
    }

    // Mark voucher as ATP-deducted (idempotency)
    txn.update(voucherRef, {
      atp_deducted: true,
      updated_at: now,
    });
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
      warehouse_id: warehouseId,
    },
  });

  console.log(
    `[deductInventoryATP] ✅ Deducted ${totalDeducted} items for voucher ${voucherId}`,
  );

  return { items_deducted: totalDeducted };
}
