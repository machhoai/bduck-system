import {
  AuditAction,
  ExportVoucherStatus,
  type ExportVoucher,
  type ExportVoucherItem,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";
import * as approvalService from "./approvalService.js";
import { logAudit } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import type { CreateExportVoucherInput } from "./exportVoucherSchemas.js";
import { onApprovalCompleted } from "./exportVoucherStateService.js";
import { verifyMfa } from "./mfaService.js";
import { getConfigForEntity } from "./processConfigService.js";
import {
  assertVoucherAccess,
  assertVoucherItemLocations,
} from "./voucherAccessPolicy.js";

export const createExportVoucher = async (
  input: CreateExportVoucherInput,
  userId: string,
  authorization: AuthorizationService,
): Promise<ExportVoucher> => {
  assertVoucherAccess(authorization, "vouchers.write", input.warehouse_id);
  await assertVoucherItemLocations(
    input.warehouse_id,
    input.items.map((item) => item.warehouse_location_id),
  );
  const config = await getConfigForEntity("EXPORT_VOUCHER", input.warehouse_id);

  if (
    config.require_evidence &&
    (!input.attachment_urls || input.attachment_urls.length === 0)
  ) {
    const err = new Error(
      "Báº¯t buá»™c táº£i lÃªn chá»©ng tá»« (evidence) khi táº¡o phiáº¿u xuáº¥t kho.",
    ) as Error & { statusCode: number; messages: Record<string, string> };
    err.statusCode = 400;
    err.messages = {
      vi: "Báº¯t buá»™c táº£i lÃªn chá»©ng tá»« (evidence) khi táº¡o phiáº¿u xuáº¥t kho.",
      zh: "åˆ›å»ºå‡ºåº“å•æ—¶å¿…é¡»ä¸Šä¼ å‡­è¯ (evidence)ã€‚",
    };
    throw err;
  }

  if (config.require_otp) {
    if (!input.otp) {
      const err = new Error(
        "MÃ£ xÃ¡c thá»±c (OTP) lÃ  báº¯t buá»™c.",
      ) as Error & {
        statusCode: number;
        messages: Record<string, string>;
      };
      err.statusCode = 400;
      err.messages = {
        vi: "MÃ£ xÃ¡c thá»±c (OTP) lÃ  báº¯t buá»™c.",
        zh: "éªŒè¯ç  (OTP) æ˜¯å¿…éœ€çš„ã€‚",
      };
      throw err;
    }
    const isOtpValid = await verifyMfa(userId, input.otp);
    if (!isOtpValid) {
      const err = new Error(
        "MÃ£ xÃ¡c thá»±c (OTP) khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n.",
      ) as Error & { statusCode: number; messages: Record<string, string> };
      err.statusCode = 400;
      err.messages = {
        vi: "MÃ£ xÃ¡c thá»±c (OTP) khÃ´ng há»£p lá»‡ hoáº·c Ä‘Ã£ háº¿t háº¡n.",
        zh: "éªŒè¯ç  (OTP) æ— æ•ˆæˆ–å·²è¿‡æœŸã€‚",
      };
      throw err;
    }
  }

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
      db
        .collection("export_vouchers")
        .doc(voucherId)
        .collection("items")
        .doc(item.id),
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
    // Resolve creator name for denormalization
    let creatorName: string | undefined;
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const u = userDoc.data();
        creatorName = u?.full_name || u?.email || undefined;
      }
    } catch {
      // Non-critical
    }

    const approvals = await approvalService.createApprovalsForEntity(
      "EXPORT_VOUCHER",
      voucherId,
      voucher.warehouse_id,
      userId,
      { voucher_number: voucherNumber, creator_name: creatorName },
    );

    if (approvals.length === 0) {
      // No chain â†’ auto-advance (includes ATP pre-check)
      await onApprovalCompleted(voucherId, "SYSTEM_AUTO_APPROVE");
    }
  } catch (error) {
    console.error("[exportVoucherService] Approval creation failed:", error);
  }

  return voucher;
};

function generateVoucherNumber(): string {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `EXP-${datePart}-${seq}`;
}
