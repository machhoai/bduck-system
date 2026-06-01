/**
 * Export Voucher Service — Fixed Pipeline State Machine
 *
 * ═══════════════════════════════════════════════════════════════
 * STATE MACHINE:
 *   DRAFT → PENDING_APPROVAL → APPROVED → PICKING → SHIPPED → COMPLETED
 *                             ↘ REJECTED → DRAFT (resubmit)
 *                                        → CANCELLED
 *
 * CRITICAL:
 * - ATP pre-check during onApprovalCompleted (HARD BLOCK if insufficient)
 * - ATP deduction during completePicking (Firestore Transaction)
 * - No negative stock allowed at any point
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  ExportVoucherStatus,
  ExportType,
  ExportReferenceType,
  AuditAction,
} from "@bduck/shared-types";
import type { ExportVoucher, ExportVoucherItem } from "@bduck/shared-types";
import * as approvalService from "./approvalService.js";
import { logAudit } from "./auditService.js";

// ─────────────────────────────────────────────
// ZOD SCHEMAS — Input validation (LUẬT THÉP)
// ─────────────────────────────────────────────

const exportVoucherItemSchema = z.object({
  product_id: z.string().uuid(),
  warehouse_location_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().min(0),
  notes: z.string().max(500).nullable().optional(),
});

export const createExportVoucherSchema = z.object({
  warehouse_id: z.string().uuid(),
  export_type: z.nativeEnum(ExportType),
  reference_id: z.string().uuid().nullable().optional(),
  reference_type: z.nativeEnum(ExportReferenceType).nullable().optional(),
  recipient_name: z.string().max(200).nullable().optional(),
  recipient_department: z.string().max(200).nullable().optional(),
  items: z.array(exportVoucherItemSchema).min(1),
  notes: z.string().max(1000).nullable().optional(),
  attachment_urls: z.array(z.string().url()).max(10).optional().default([]),
  action_time: z.string().datetime().optional(),
});

export type CreateExportVoucherInput = z.infer<
  typeof createExportVoucherSchema
>;

// ─────────────────────────────────────────────
// SERVICE — createExportVoucher
// ─────────────────────────────────────────────

export const createExportVoucher = async (
  input: CreateExportVoucherInput,
  userId: string,
): Promise<ExportVoucher> => {
  const now = new Date();
  const actionTime = input.action_time ? new Date(input.action_time) : now;
  const voucherId = randomUUID();
  const voucherNumber = generateVoucherNumber();

  const voucher: ExportVoucher = {
    id: voucherId,
    voucher_number: voucherNumber,
    warehouse_id: input.warehouse_id,
    export_type: input.export_type,
    status: ExportVoucherStatus.PENDING_APPROVAL,
    creator_id: userId,
    approver_id: null,
    approved_at: null,
    reference_id: input.reference_id ?? null,
    reference_type: input.reference_type ?? null,
    recipient_name: input.recipient_name ?? null,
    recipient_department: input.recipient_department ?? null,
    notes: input.notes ?? null,
    attachment_urls: input.attachment_urls ?? [],
    action_time: actionTime,
    sync_time: now,
    atp_deducted: false,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };

  const items: ExportVoucherItem[] = input.items.map((item) => ({
    id: randomUUID(),
    export_voucher_id: voucherId,
    product_id: item.product_id,
    warehouse_location_id: item.warehouse_location_id,
    quantity: item.quantity,
    picked_quantity: 0,
    unit_price: item.unit_price,
    notes: item.notes ?? null,
    is_deleted: false,
  }));

  // Batch write
  const batch = db.batch();
  batch.set(db.collection("export_vouchers").doc(voucherId), voucher);
  for (const item of items) {
    batch.set(
      db.collection("export_vouchers").doc(voucherId).collection("items").doc(item.id),
      item,
    );
  }
  await batch.commit();

  // Audit (ISO 9001)
  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: voucher as unknown as Record<string, unknown>,
    action_time: actionTime,
  });

  // Trigger approval chain
  try {
    const approvals = await approvalService.createApprovalsForEntity(
      "EXPORT_VOUCHER",
      voucherId,
      voucher.warehouse_id,
      userId,
    );

    if (approvals.length === 0) {
      // No chain → auto-advance (includes ATP pre-check)
      await onApprovalCompleted(voucherId, "SYSTEM_AUTO_APPROVE");
    }
  } catch (error) {
    console.error("[exportVoucherService] Approval creation failed:", error);
  }

  return voucher;
};

// ─────────────────────────────────────────────
// STATE MACHINE — Callbacks
// ─────────────────────────────────────────────

/**
 * Called when approval is completed.
 * CRITICAL: Pre-checks ATP before advancing to APPROVED.
 * If ATP insufficient → throws 400, voucher stays PENDING_APPROVAL.
 */
export async function onApprovalCompleted(
  voucherId: string,
  approverId: string,
): Promise<void> {
  // ATP Pre-check: read all items and verify inventory
  await validateAtpSufficiency(voucherId);

  const now = new Date();
  await db.collection("export_vouchers").doc(voucherId).update({
    status: ExportVoucherStatus.APPROVED,
    approver_id: approverId,
    approved_at: now,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: null,
    action: AuditAction.APPROVE,
    user_id: approverId,
    old_value: { status: ExportVoucherStatus.PENDING_APPROVAL },
    new_value: { status: ExportVoucherStatus.APPROVED },
  });
}

export async function onApprovalRejected(
  voucherId: string,
  rejectorId: string,
  reason: string,
): Promise<void> {
  const now = new Date();
  await db.collection("export_vouchers").doc(voucherId).update({
    status: ExportVoucherStatus.REJECTED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: null,
    action: AuditAction.REJECT,
    user_id: rejectorId,
    old_value: { status: ExportVoucherStatus.PENDING_APPROVAL },
    new_value: { status: ExportVoucherStatus.REJECTED, reason },
  });
}

/** APPROVED → PICKING (thủ kho bắt đầu soạn hàng) */
export async function startPicking(voucherId: string): Promise<void> {
  const now = new Date();
  await db.collection("export_vouchers").doc(voucherId).update({
    status: ExportVoucherStatus.PICKING,
    updated_at: now,
    sync_time: now,
  });

  // Mirror to Transfer Order if linked
  try {
    const { syncExportStatus } = await import("./transferOrderService.js");
    await syncExportStatus(voucherId, ExportVoucherStatus.PICKING);
  } catch { /* no linked transfer */ }
}

/**
 * PICKING → SHIPPED
 * Deducts ATP via Firestore Transaction.
 */
export async function completePicking(
  voucherId: string,
  userId: string,
): Promise<void> {
  const { deductInventoryATP } = await import("./actions/deductInventoryATP.js");
  await deductInventoryATP(voucherId, userId);

  const now = new Date();
  await db.collection("export_vouchers").doc(voucherId).update({
    status: ExportVoucherStatus.SHIPPED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: null,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: ExportVoucherStatus.PICKING },
    new_value: { status: ExportVoucherStatus.SHIPPED },
  });

  // Mirror to Transfer Order if linked
  try {
    const { syncExportStatus } = await import("./transferOrderService.js");
    await syncExportStatus(voucherId, ExportVoucherStatus.SHIPPED);
  } catch { /* no linked transfer */ }
}

/** SHIPPED → COMPLETED (kế toán xác nhận) */
export async function completeExport(
  voucherId: string,
  userId: string,
): Promise<void> {
  const now = new Date();
  await db.collection("export_vouchers").doc(voucherId).update({
    status: ExportVoucherStatus.COMPLETED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: null,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: ExportVoucherStatus.SHIPPED },
    new_value: { status: ExportVoucherStatus.COMPLETED },
  });
}

// ─────────────────────────────────────────────
// ATP VALIDATION — Hard Block
// ─────────────────────────────────────────────

/**
 * Validates that warehouse has sufficient ATP for all items.
 * Called during onApprovalCompleted BEFORE advancing to APPROVED.
 *
 * @throws 400 with specific product info if ATP insufficient
 */
async function validateAtpSufficiency(voucherId: string): Promise<void> {
  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();
  if (!voucherSnap.exists) return;

  const voucher = voucherSnap.data()!;
  const warehouseId = voucher.warehouse_id as string;

  const itemsSnap = await voucherRef
    .collection("items")
    .where("is_deleted", "==", false)
    .get();

  for (const doc of itemsSnap.docs) {
    const item = doc.data();
    const requestedQty = item.quantity as number;
    const productId = item.product_id as string;
    const locationId = item.warehouse_location_id as string;

    // Query inventory for this product at this location
    // CRITICAL: Filter is_deleted client-side to avoid composite index requirement
    const invSnapRaw = await db
      .collection("inventory")
      .where("warehouse_id", "==", warehouseId)
      .where("warehouse_location_id", "==", locationId)
      .where("product_id", "==", productId)
      .limit(5)
      .get();
    const activeInvDocs = invSnapRaw.docs.filter((d) => d.data().is_deleted !== true);

    const currentAtp = activeInvDocs.length === 0
      ? 0
      : (activeInvDocs[0].data().atp_quantity as number) || 0;

    if (currentAtp < requestedQty) {
      // Resolve product name + location name for human-readable error
      let productLabel = productId;
      let locationLabel = locationId;
      try {
        const [productSnap, locationSnap] = await Promise.all([
          db.collection("products").doc(productId).get(),
          db.collection("warehouse_locations").doc(locationId).get(),
        ]);
        if (productSnap.exists) {
          const pData = productSnap.data()!;
          productLabel = `${pData.name || ""} (${pData.code || productId})`;
        }
        if (locationSnap.exists) {
          const lData = locationSnap.data()!;
          locationLabel = `${lData.name || ""} (${lData.code || locationId})`;
        }
      } catch {
        // Fallback to IDs if name resolution fails
      }

      throw Object.assign(new Error("Insufficient ATP"), {
        statusCode: 400,
        messages: {
          vi: `Không đủ tồn kho khả dụng. Sản phẩm: ${productLabel}, Vị trí: ${locationLabel}, ATP hiện tại: ${currentAtp}, Yêu cầu: ${requestedQty}.`,
          zh: `可用库存不足。产品：${productLabel}，库位：${locationLabel}，当前ATP：${currentAtp}，请求：${requestedQty}。`,
        },
      });
    }
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function generateVoucherNumber(): string {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `EXP-${datePart}-${seq}`;
}
