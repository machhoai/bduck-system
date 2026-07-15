import { AuditAction, TransferOrderStatus } from "@bduck/shared-types";
import * as transferRepo from "../repositories/transferOrderRepository.js";
import { logAudit } from "./auditService.js";
import { createExportFromTransferInternal } from "./transferOrderExportService.js";
import { createTransferError } from "./transferOrderSupport.js";
import { loadTransferOrder } from "./transferAccessPolicy.js";

export async function onApprovalCompleted(
  orderId: string,
  approverId: string,
): Promise<void> {
  const order = await loadTransferOrder(orderId);
  if (!order)
    throw createTransferError(404, "Không tìm thấy phiếu.", "找不到单据。");

  const now = new Date();
  const autoCreate = order.config_snapshot?.auto_create_export !== false;

  if (autoCreate) {
    // Auto-create export voucher
    await createExportFromTransferInternal(order, now, [], approverId);
  } else {
    // Wait for manual export creation
    await transferRepo.update(orderId, {
      status: TransferOrderStatus.APPROVED,
      approver_id: approverId,
      approved_at: now,
      updated_at: now,
      sync_time: now,
    });
  }

  await logAudit({
    entity_type: "TRANSFER_ORDER",
    entity_id: orderId,
    warehouse_id: order.source_warehouse_id,
    action: AuditAction.APPROVE,
    user_id: approverId,
    old_value: { status: TransferOrderStatus.PENDING_APPROVAL },
    new_value: {
      status: autoCreate
        ? TransferOrderStatus.EXPORT_CREATED
        : TransferOrderStatus.APPROVED,
    },
  });
}

/**
 * Called when approval is rejected.
 */
export async function onApprovalRejected(
  orderId: string,
  rejectorId: string,
  reason: string,
): Promise<void> {
  const order = await loadTransferOrder(orderId);
  const now = new Date();
  await transferRepo.update(orderId, {
    status: TransferOrderStatus.REJECTED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "TRANSFER_ORDER",
    entity_id: orderId,
    warehouse_id: order?.source_warehouse_id ?? null,
    action: AuditAction.REJECT,
    user_id: rejectorId,
    old_value: { status: TransferOrderStatus.PENDING_APPROVAL },
    new_value: { status: TransferOrderStatus.REJECTED, reason },
  });
}

/**
 * Called when the creator cancels their own transfer order.
 * Advances order from PENDING_APPROVAL → CANCELLED.
 */
export async function onApprovalCancelled(
  orderId: string,
  userId: string,
  reason?: string | null,
): Promise<void> {
  const order = await loadTransferOrder(orderId);
  const now = new Date();
  await transferRepo.update(orderId, {
    status: TransferOrderStatus.CANCELLED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "TRANSFER_ORDER",
    entity_id: orderId,
    warehouse_id: order?.source_warehouse_id ?? null,
    action: AuditAction.CANCEL,
    user_id: userId,
    old_value: { status: TransferOrderStatus.PENDING_APPROVAL },
    new_value: {
      status: TransferOrderStatus.CANCELLED,
      reason: reason || null,
    },
  });
}

// ─────────────────────────────────────────────
// CREATE EXPORT FROM TRANSFER (1-click)
// ─────────────────────────────────────────────

/**
 * Public API: Manual 1-click creation of Export Voucher from Transfer.
 * Called when auto_create_export=false and user clicks "Tạo lệnh xuất kho".
 */
