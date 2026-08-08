import {
  ExportReferenceType,
  ExportType,
  ExportVoucherStatus,
  type ExportVoucher,
  type TransferOrder,
  type User,
} from "@bduck/shared-types";

interface BuildTransferExportVoucherInput {
  order: TransferOrder;
  exportId: string;
  exportNumber: string;
  now: Date;
  attachmentUrls: string[];
}

type TransferExportCreator = Pick<User, "full_name" | "email">;

export function buildTransferExportNotes(orderNumber: string): string {
  return `Phiếu xuất được tạo từ phiếu điều chuyển ${orderNumber}`;
}

export function buildTransferExportVoucher(
  input: BuildTransferExportVoucherInput,
): ExportVoucher {
  const { order, exportId, exportNumber, now, attachmentUrls } = input;

  return {
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
    notes: buildTransferExportNotes(order.order_number),
    attachment_urls: attachmentUrls,
    action_time: now,
    sync_time: now,
    atp_deducted: false,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
}

export function buildTransferExportApprovalDisplayInfo(
  voucher: Pick<ExportVoucher, "voucher_number" | "creator_id">,
  creator: TransferExportCreator | null,
): { voucher_number: string; creator_name: string } {
  return {
    voucher_number: voucher.voucher_number,
    creator_name:
      creator?.full_name || creator?.email || voucher.creator_id,
  };
}
