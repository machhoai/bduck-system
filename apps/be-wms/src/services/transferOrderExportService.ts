import {
  AuditAction,
  ExportReferenceType,
  ExportType,
  ExportVoucherStatus,
  TransferOrderStatus,
  type ExportVoucher,
  type ExportVoucherItem,
  type TransferOrder,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";
import * as approvalService from "./approvalService.js";
import { logAudit } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import { createTransferError } from "./transferOrderSupport.js";
import {
  assertTransferWriteAccess,
  loadTransferOrder,
} from "./transferAccessPolicy.js";

export async function createExportFromTransfer(
  orderId: string,
  userId: string,
  additionalAttachmentUrls: string[] = [],
  authorization: AuthorizationService,
): Promise<ExportVoucher> {
  const order = await loadTransferOrder(orderId);
  assertTransferWriteAccess(authorization, order.source_warehouse_id);
  if (!order)
    throw createTransferError(404, "Không tìm thấy phiếu.", "找不到单据。");

  if (
    order.status !== TransferOrderStatus.APPROVED &&
    order.status !== TransferOrderStatus.EXPORT_PENDING
  ) {
    throw createTransferError(
      400,
      "Phiếu điều chuyển chưa được duyệt hoặc đã tạo lệnh xuất.",
      "调拨单尚未审批或已创建出库单。",
    );
  }

  const now = new Date();
  const exportVoucher = await createExportFromTransferInternal(
    order,
    now,
    additionalAttachmentUrls,
  );

  await logAudit({
    entity_type: "TRANSFER_ORDER",
    entity_id: orderId,
    warehouse_id: order.source_warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: order.status },
    new_value: {
      status: TransferOrderStatus.EXPORT_CREATED,
      export_voucher_id: exportVoucher.id,
    },
  });

  return exportVoucher;
}

/**
 * Internal: Creates Export Voucher from Transfer Order.
 * Auto-attaches transfer attachments + allows additional ones.
 */
export async function createExportFromTransferInternal(
  order: TransferOrder,
  now: Date,
  additionalAttachmentUrls: string[] = [],
  approvedBy?: string,
): Promise<ExportVoucher> {
  const exportId = randomUUID();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  const exportNumber = `EXP-${datePart}-${seq}`;

  // Merge attachments: transfer origin + additional
  const mergedAttachments = [
    ...(order.attachment_urls ?? []),
    ...additionalAttachmentUrls,
  ];

  const exportVoucher: ExportVoucher = {
    id: exportId,
    voucher_number: exportNumber,
    warehouse_id: order.source_warehouse_id,
    export_type: ExportType.TRANSFER,
    status: ExportVoucherStatus.PENDING_APPROVAL,
    creator_id: order.creator_id,
    approver_id: null,
    approved_at: null,
    reference_id: order.id,
    reference_type: ExportReferenceType.TRANSFER_ORDER,
    recipient_name: null,
    recipient_department: null,
    notes: `Lệnh xuất từ điều chuyển ${order.order_number}`,
    attachment_urls: mergedAttachments,
    action_time: now,
    sync_time: now,
    atp_deducted: false,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };

  const orderRef = db.collection("transfer_orders").doc(order.id);
  const transferItemsQuery = orderRef
    .collection("items")
    .where("is_deleted", "==", false);
  const exportRef = db.collection("export_vouchers").doc(exportId);

  await db.runTransaction(async (transaction) => {
    const [currentOrderSnap, transferItemsSnap] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(transferItemsQuery),
    ]);
    const currentOrder = currentOrderSnap.data() as TransferOrder | undefined;
    if (
      !currentOrderSnap.exists ||
      !currentOrder ||
      currentOrder.is_deleted !== false ||
      currentOrder.source_warehouse_id !== order.source_warehouse_id ||
      currentOrder.destination_warehouse_id !==
        order.destination_warehouse_id ||
      currentOrder.export_voucher_id
    ) {
      throw createTransferError(
        409,
        "Phiếu điều chuyển đã thay đổi hoặc đã có lệnh xuất.",
        "调拨单已更改或已有出库单。",
      );
    }

    transaction.set(exportRef, exportVoucher);
    for (const document of transferItemsSnap.docs) {
      const item = document.data();
      const exportItem: ExportVoucherItem = {
        id: randomUUID(),
        export_voucher_id: exportId,
        product_id: item.product_id,
        warehouse_location_id: item.source_location_id,
        quantity: item.quantity,
        picked_quantity: 0,
        unit_price: 0,
        notes: null,
        is_deleted: false,
      };
      transaction.set(
        exportRef.collection("items").doc(exportItem.id),
        exportItem,
      );
    }
    transaction.update(orderRef, {
      status: TransferOrderStatus.EXPORT_CREATED,
      export_voucher_id: exportId,
      ...(approvedBy ? { approver_id: approvedBy, approved_at: now } : {}),
      updated_at: now,
      sync_time: now,
    });
  });

  // Create approval records for the export voucher
  try {
    const approvals = await approvalService.createApprovalsForEntity(
      "EXPORT_VOUCHER",
      exportId,
      order.source_warehouse_id,
      order.creator_id,
      undefined,
      {
        sourceWarehouseId: order.source_warehouse_id,
        destinationWarehouseId: order.destination_warehouse_id,
      },
    );

    if (approvals.length === 0) {
      const { onApprovalCompleted: onExportApproved } =
        await import("./exportVoucherService.js");
      await onExportApproved(exportId, "SYSTEM_AUTO_APPROVE");
    }
  } catch (error) {
    console.error(
      "[transferOrderService] Export approval creation failed:",
      error,
    );
  }

  return exportVoucher;
}

// ─────────────────────────────────────────────
// EXPORT STATUS MIRROR
// ─────────────────────────────────────────────

/**
 * Called by exportVoucherService when Export Voucher status changes.
 * Mirrors status back to Transfer Order.
 */
export async function syncExportStatus(
  exportVoucherId: string,
  newExportStatus: string,
): Promise<void> {
  // Find the transfer order linked to this export
  const snap = await db
    .collection("transfer_orders")
    .where("export_voucher_id", "==", exportVoucherId)
    .where("is_deleted", "==", false)
    .limit(1)
    .get();

  if (snap.empty) return;

  const transferDoc = snap.docs[0];
  const now = new Date();
  let newTransferStatus: TransferOrderStatus | null = null;

  switch (newExportStatus) {
    case ExportVoucherStatus.PICKING:
      newTransferStatus = TransferOrderStatus.PICKING;
      break;
    case ExportVoucherStatus.SHIPPED:
      newTransferStatus = TransferOrderStatus.PENDING_RECEIVE;
      break;
    case ExportVoucherStatus.COMPLETED:
      // Export completed doesn't auto-complete transfer; need receiving first
      break;
  }

  if (newTransferStatus) {
    await transferDoc.ref.update({
      status: newTransferStatus,
      updated_at: now,
      sync_time: now,
      ...(newTransferStatus === TransferOrderStatus.PENDING_RECEIVE
        ? { dispatched_at: now }
        : {}),
    });
  }
}

// ─────────────────────────────────────────────
// RECEIVE TRANSFER
// ─────────────────────────────────────────────

/**
 * Start receiving: PENDING_RECEIVE → RECEIVING
 */
