import assert from "node:assert/strict";
import test from "node:test";

import {
  ExportReferenceType,
  ExportType,
  ExportVoucherStatus,
  TransferOrderStatus,
  TransferType,
  type TransferOrder,
} from "@bduck/shared-types";

import {
  buildTransferExportApprovalDisplayInfo,
  buildTransferExportVoucher,
} from "./transferOrderExportPolicy.js";

const now = new Date("2026-08-04T08:00:00.000Z");
const order: TransferOrder = {
  id: "transfer-a",
  order_number: "TRF-X-20260804-001",
  transfer_type: TransferType.INTER_WAREHOUSE,
  source_warehouse_id: "warehouse-source",
  destination_warehouse_id: "warehouse-destination",
  status: TransferOrderStatus.APPROVED,
  creator_id: "creator-a",
  approver_id: "approver-a",
  approved_at: now,
  export_voucher_id: null,
  received_by: null,
  received_at: null,
  dispatched_at: null,
  attachment_urls: [],
  config_snapshot: null,
  requires_reauth: false,
  reauth_confirmed_by: null,
  reauth_confirmed_at: null,
  action_time: now,
  sync_time: now,
  notes: null,
  is_deleted: false,
  created_at: now,
  updated_at: now,
};

test("transfer approval creates a complete linked export voucher", () => {
  const voucher = buildTransferExportVoucher({
    order,
    exportId: "export-a",
    exportNumber: "EXP-20260804-001",
    now,
    attachmentUrls: ["https://example.com/evidence.pdf"],
  });

  assert.equal(voucher.voucher_number, "EXP-20260804-001");
  assert.equal(voucher.creator_id, order.creator_id);
  assert.equal(voucher.warehouse_id, order.source_warehouse_id);
  assert.equal(voucher.export_type, ExportType.TRANSFER);
  assert.equal(voucher.status, ExportVoucherStatus.PENDING_APPROVAL);
  assert.equal(voucher.reference_id, order.id);
  assert.equal(voucher.reference_type, ExportReferenceType.TRANSFER_ORDER);
  assert.equal(
    voucher.notes,
    `Phiếu xuất được tạo từ phiếu điều chuyển ${order.order_number}`,
  );
});

test("transfer export approval task includes voucher number and creator name", () => {
  const voucher = buildTransferExportVoucher({
    order,
    exportId: "export-a",
    exportNumber: "EXP-20260804-001",
    now,
    attachmentUrls: [],
  });

  assert.deepEqual(
    buildTransferExportApprovalDisplayInfo(voucher, {
      full_name: "Nguyễn Văn A",
      email: "a@example.com",
    }),
    {
      voucher_number: "EXP-20260804-001",
      creator_name: "Nguyễn Văn A",
    },
  );
  assert.equal(
    buildTransferExportApprovalDisplayInfo(voucher, null).creator_name,
    order.creator_id,
  );
});
