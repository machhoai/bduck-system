import { AuditAction, ImportVoucherStatus } from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { logAudit } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  assertVoucherAccess,
  loadImportVoucher,
} from "./voucherAccessPolicy.js";

export async function onApprovalCompleted(
  voucherId: string,
  approverId: string,
): Promise<void> {
  const voucher = await loadImportVoucher(voucherId);
  const now = new Date();
  await db.collection("import_vouchers").doc(voucherId).update({
    status: ImportVoucherStatus.APPROVED,
    approver_id: approverId,
    approved_at: now,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "IMPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.APPROVE,
    user_id: approverId,
    old_value: { status: ImportVoucherStatus.PENDING_APPROVAL },
    new_value: { status: ImportVoucherStatus.APPROVED },
  });
}

/**
 * Called by approvalController when an approval is rejected.
 * Advances voucher from PENDING_APPROVAL â†’ REJECTED.
 */
export async function onApprovalRejected(
  voucherId: string,
  rejectorId: string,
  reason: string,
): Promise<void> {
  const voucher = await loadImportVoucher(voucherId);
  const now = new Date();
  await db.collection("import_vouchers").doc(voucherId).update({
    status: ImportVoucherStatus.REJECTED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "IMPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.REJECT,
    user_id: rejectorId,
    old_value: { status: ImportVoucherStatus.PENDING_APPROVAL },
    new_value: { status: ImportVoucherStatus.REJECTED, reason },
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
  const voucher = await loadImportVoucher(voucherId);
  const now = new Date();
  await db.collection("import_vouchers").doc(voucherId).update({
    status: ImportVoucherStatus.CANCELLED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "IMPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.CANCEL,
    user_id: userId,
    old_value: { status: ImportVoucherStatus.PENDING_APPROVAL },
    new_value: {
      status: ImportVoucherStatus.CANCELLED,
      reason: reason || null,
    },
  });
}

/**
 * Called when receiving session data is saved and user completes receiving.
 * Advances voucher from APPROVED â†’ RECEIVING.
 */
export async function startReceiving(
  voucherId: string,
  authorization: AuthorizationService,
): Promise<void> {
  const voucher = await loadImportVoucher(voucherId);
  assertVoucherAccess(authorization, "vouchers.write", voucher.warehouse_id);
  const now = new Date();
  await db.collection("import_vouchers").doc(voucherId).update({
    status: ImportVoucherStatus.RECEIVING,
    updated_at: now,
    sync_time: now,
  });
}

/**
 * Called when receiving session is completed and inventory needs updating.
 * Advances voucher from RECEIVING â†’ COMPLETED.
 * Calls updateInventoryATP DIRECTLY (no registry).
 */
export async function completeReceiving(
  voucherId: string,
  userId: string,
  authorization: AuthorizationService,
): Promise<void> {
  const voucher = await loadImportVoucher(voucherId);
  assertVoucherAccess(authorization, "vouchers.write", voucher.warehouse_id);
  // Import dynamically to avoid circular dependency
  const { updateInventoryATP } =
    await import("./actions/updateInventoryATP.js");
  const { createNonconformity } =
    await import("./actions/createNonconformity.js");

  // Call ATP update directly â€” no registry lookup
  await updateInventoryATP(
    {},
    {
      instanceId: `direct_${voucherId}`,
      entityPayload: {
        voucher_id: voucherId,
        entity_type: "IMPORT_VOUCHER",
      },
      userId,
    },
  );

  // Create post-receiving exception reports and lock affected inventory buckets.
  await createNonconformity(
    {},
    {
      instanceId: `direct_${voucherId}`,
      entityPayload: {
        voucher_id: voucherId,
        entity_type: "IMPORT_VOUCHER",
      },
      userId,
    },
  );

  // Advance status to COMPLETED
  const now = new Date();
  await db.collection("import_vouchers").doc(voucherId).update({
    status: ImportVoucherStatus.COMPLETED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "IMPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: ImportVoucherStatus.RECEIVING },
    new_value: { status: ImportVoucherStatus.COMPLETED },
  });
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// HELPERS
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Generate sequential voucher number: IMP-YYYYMMDD-XXX
 * In production, use Firestore counters or Cloud Functions
 * for guaranteed uniqueness. This is a simplified version.
 */
