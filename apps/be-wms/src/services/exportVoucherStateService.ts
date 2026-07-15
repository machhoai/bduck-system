import {
  AuditAction,
  ExportReferenceType,
  ExportVoucherStatus,
  type ExportVoucher,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { logAudit } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { validateAtpSufficiency } from "./exportVoucherAtpService.js";
import {
  assertVoucherAccess,
  loadExportVoucher,
} from "./voucherAccessPolicy.js";

export async function onApprovalCompleted(
  voucherId: string,
  approverId: string,
): Promise<void> {
  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();
  if (!voucherSnap.exists) return;

  const voucher = voucherSnap.data() as ExportVoucher;
  if (
    voucher.reference_type === ExportReferenceType.EXTERNAL_QUEUE_BATCH &&
    voucher.reference_id
  ) {
    const { finalizeApprovedBatchFromVoucher } =
      await import("./externalScanService.js");
    await finalizeApprovedBatchFromVoucher(voucherId, approverId);
    return;
  }

  // ATP Pre-check: read all items and verify inventory
  await validateAtpSufficiency(voucherId);

  const now = new Date();
  await voucherRef.update({
    status: ExportVoucherStatus.APPROVED,
    approver_id: approverId,
    approved_at: now,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
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
  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();
  if (!voucherSnap.exists) return;
  const voucher = voucherSnap.data() as ExportVoucher;
  const now = new Date();

  await voucherRef.update({
    status: ExportVoucherStatus.REJECTED,
    updated_at: now,
    sync_time: now,
  });

  if (
    voucher.reference_type === ExportReferenceType.EXTERNAL_QUEUE_BATCH &&
    voucher.reference_id
  ) {
    const { returnBatchForRevisionFromVoucher } =
      await import("./externalScanService.js");
    await returnBatchForRevisionFromVoucher(voucherId, rejectorId, reason);
  }

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.REJECT,
    user_id: rejectorId,
    old_value: { status: ExportVoucherStatus.PENDING_APPROVAL },
    new_value: { status: ExportVoucherStatus.REJECTED, reason },
  });
}

/**
 * Called when the creator cancels their own voucher.
 * Advances voucher from PENDING_APPROVAL â†’ CANCELLED.
 */
export async function onApprovalCancelled(
  voucherId: string,
  userId: string,
  reason?: string | null,
): Promise<void> {
  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();
  const voucher = voucherSnap.exists
    ? (voucherSnap.data() as ExportVoucher)
    : null;
  const now = new Date();
  await voucherRef.update({
    status: ExportVoucherStatus.CANCELLED,
    updated_at: now,
    sync_time: now,
  });

  if (
    voucher?.reference_type === ExportReferenceType.EXTERNAL_QUEUE_BATCH &&
    voucher.reference_id
  ) {
    const { cancelBatchFromVoucher } = await import("./externalScanService.js");
    await cancelBatchFromVoucher(
      voucherId,
      userId,
      reason || "External queue export voucher cancelled",
    );
  }

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher?.warehouse_id ?? null,
    action: AuditAction.CANCEL,
    user_id: userId,
    old_value: { status: ExportVoucherStatus.PENDING_APPROVAL },
    new_value: {
      status: ExportVoucherStatus.CANCELLED,
      reason: reason || null,
    },
  });
}

/** APPROVED â†’ PICKING (thá»§ kho báº¯t Ä‘áº§u soáº¡n hÃ ng) */
export async function startPicking(
  voucherId: string,
  authorization: AuthorizationService,
): Promise<void> {
  const voucher = await loadExportVoucher(voucherId);
  assertVoucherAccess(authorization, "vouchers.write", voucher.warehouse_id);
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
  } catch {
    /* no linked transfer */
  }
}

/**
 * PICKING â†’ SHIPPED
 * Deducts ATP via Firestore Transaction.
 */
export async function completePicking(
  voucherId: string,
  userId: string,
  authorization: AuthorizationService,
): Promise<void> {
  const voucher = await loadExportVoucher(voucherId);
  assertVoucherAccess(authorization, "vouchers.write", voucher.warehouse_id);
  const { deductInventoryATP } =
    await import("./actions/deductInventoryATP.js");
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
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: ExportVoucherStatus.PICKING },
    new_value: { status: ExportVoucherStatus.SHIPPED },
  });

  // Mirror to Transfer Order if linked
  try {
    const { syncExportStatus } = await import("./transferOrderService.js");
    await syncExportStatus(voucherId, ExportVoucherStatus.SHIPPED);
  } catch {
    /* no linked transfer */
  }
}

/** SHIPPED â†’ COMPLETED (káº¿ toÃ¡n xÃ¡c nháº­n) */
export async function completeExport(
  voucherId: string,
  userId: string,
  authorization: AuthorizationService,
): Promise<void> {
  const voucher = await loadExportVoucher(voucherId);
  assertVoucherAccess(authorization, "vouchers.write", voucher.warehouse_id);
  const now = new Date();
  await db.collection("export_vouchers").doc(voucherId).update({
    status: ExportVoucherStatus.COMPLETED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: ExportVoucherStatus.SHIPPED },
    new_value: { status: ExportVoucherStatus.COMPLETED },
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ATP VALIDATION â€” Hard Block
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Validates that warehouse has sufficient ATP for all items.
 * Called during onApprovalCompleted BEFORE advancing to APPROVED.
 *
 * @throws 400 with specific product info if ATP insufficient
 */
