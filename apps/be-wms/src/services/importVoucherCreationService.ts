import { randomUUID } from "crypto";

import {
  AuditAction,
  ImportVoucherStatus,
  type ImportVoucher,
  type ImportVoucherItem,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";
import * as approvalRepository from "../repositories/approvalRepository.js";
import { getUserById } from "../repositories/userRepository.js";

import { prepareApprovalsForEntity } from "./approvalPreparationService.js";
import * as approvalService from "./approvalService.js";
import { logAudit } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import type { CreateImportVoucherInput } from "./importVoucherSchemas.js";
import { verifyMfa } from "./mfaService.js";
import { getConfigForEntity } from "./processConfigService.js";
import {
  assertVoucherAccess,
  assertVoucherItemLocations,
} from "./voucherAccessPolicy.js";

export const createImportVoucher = async (
  input: CreateImportVoucherInput,
  userId: string,
  authorization: AuthorizationService,
): Promise<ImportVoucher> => {
  assertVoucherAccess(authorization, "vouchers.write", input.warehouse_id);
  await assertVoucherItemLocations(
    input.warehouse_id,
    input.items.map((item) => item.warehouse_location_id),
  );
  const config = await getConfigForEntity("IMPORT_VOUCHER", input.warehouse_id);

  if (
    config.require_evidence &&
    (!input.attachment_urls || input.attachment_urls.length === 0)
  ) {
    const err = new Error(
      "Bắt buộc tải lên chứng từ (evidence) khi tạo phiếu nhập kho.",
    ) as Error & { statusCode: number; messages: Record<string, string> };
    err.statusCode = 400;
    err.messages = {
      vi: "Bắt buộc tải lên chứng từ (evidence) khi tạo phiếu nhập kho.",
      zh: "创建入库单时必须上传凭证 (evidence)。",
    };
    throw err;
  }

  if (config.require_otp) {
    if (!input.otp) {
      const err = new Error(
        "Mã xác thực (OTP) là bắt buộc.",
      ) as Error & {
        statusCode: number;
        messages: Record<string, string>;
      };
      err.statusCode = 400;
      err.messages = {
        vi: "Mã xác thực (OTP) là bắt buộc.",
        zh: "验证码 (OTP) 是必需的。",
      };
      throw err;
    }
    const isOtpValid = await verifyMfa(userId, input.otp);
    if (!isOtpValid) {
      const err = new Error(
        "Mã xác thực (OTP) không hợp lệ hoặc đã hết hạn.",
      ) as Error & { statusCode: number; messages: Record<string, string> };
      err.statusCode = 400;
      err.messages = {
        vi: "Mã xác thực (OTP) không hợp lệ hoặc đã hết hạn.",
        zh: "验证码 (OTP) 无效或已过期。",
      };
      throw err;
    }
  }

  const now = new Date();
  const actionTime = input.action_time ? new Date(input.action_time) : now;
  const voucherId = randomUUID();
  const voucherNumber = generateVoucherNumber();
  const creator = await getUserById(userId);
  const creatorName = creator?.full_name || creator?.email || undefined;
  const approvalPlan = await prepareApprovalsForEntity({
    entityType: "IMPORT_VOUCHER",
    entityId: voucherId,
    warehouseId: input.warehouse_id,
    creatorId: userId,
    displayInfo: {
      voucher_number: voucherNumber,
      creator_name: creatorName,
    },
    options: { config },
  });

  // ── 1. Build voucher document ──
  const voucher: ImportVoucher = {
    id: voucherId,
    voucher_number: voucherNumber,
    warehouse_id: input.warehouse_id,
    supplier_name: input.supplier_name,
    purchase_order_id: input.purchase_order_id ?? null,
    status:
      approvalPlan.mode === "RECORDS"
        ? ImportVoucherStatus.PENDING_APPROVAL
        : ImportVoucherStatus.APPROVED,
    creator_id: userId,
    approver_id: null, // Self-Approval Block: assigned by approvalService
    approved_at: null,
    action_time: actionTime,
    sync_time: now,
    notes: input.notes ?? null,
    attachment_urls: input.attachment_urls ?? [],
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };

  // ── 2. Build item documents ──
  const items: ImportVoucherItem[] = input.items.map((item) => ({
    id: randomUUID(),
    import_voucher_id: voucherId,
    product_id: item.product_id,
    warehouse_location_id: item.warehouse_location_id,
    expected_quantity: item.expected_quantity,
    actual_quantity: item.actual_quantity,
    unit_price: item.unit_price,
    condition: item.condition,
    notes: item.notes ?? null,
    is_deleted: false,
  }));

  // ── 3. Write to Firestore (batch for atomicity) ──
  const batch = db.batch();

  batch.set(db.collection("import_vouchers").doc(voucherId), voucher);

  for (const item of items) {
    batch.set(
      db
        .collection("import_vouchers")
        .doc(voucherId)
        .collection("items")
        .doc(item.id),
      item,
    );
  }
  if (approvalPlan.mode === "RECORDS") {
    approvalRepository.stageCreateBatch(batch, approvalPlan.records);
  }

  await batch.commit();

  // ── 4. Write audit log (ISO 9001) ──
  await logAudit({
    entity_type: "IMPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: voucher as unknown as Record<string, unknown>,
    action_time: actionTime,
  });

  // ── 5. Dispatch notifications/audit after the atomic write succeeds ──
  await approvalService.completePreparedApprovals(approvalPlan);

  return voucher;
};

// ─────────────────────────────────────────────
// STATE MACHINE — Callbacks
// ─────────────────────────────────────────────

/**
 * Called by approvalController when all approval levels are completed.
 * Advances voucher from PENDING_APPROVAL → APPROVED.
 */

function generateVoucherNumber(): string {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `IMP-${datePart}-${seq}`;
}
