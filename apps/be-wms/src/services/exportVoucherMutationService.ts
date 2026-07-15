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
import type { UpdateExportVoucherInput } from "./exportVoucherSchemas.js";
import { onApprovalCompleted } from "./exportVoucherStateService.js";
import { verifyMfa } from "./mfaService.js";
import { getConfigForEntity } from "./processConfigService.js";
import {
  assertVoucherAccess,
  assertVoucherItemLocations,
} from "./voucherAccessPolicy.js";

export const updateExportVoucher = async (
  voucherId: string,
  input: UpdateExportVoucherInput,
  userId: string,
  authorization: AuthorizationService,
): Promise<ExportVoucher> => {
  assertVoucherAccess(authorization, "vouchers.write", input.warehouse_id);
  const config = await getConfigForEntity("EXPORT_VOUCHER", input.warehouse_id);

  if (
    config.require_evidence &&
    (!input.attachment_urls || input.attachment_urls.length === 0)
  ) {
    const err = new Error(
      "Bat buoc tai len chung tu khi sua phieu xuat kho.",
    ) as Error & { statusCode: number; messages: Record<string, string> };
    err.statusCode = 400;
    err.messages = {
      vi: "Bat buoc tai len chung tu khi sua phieu xuat kho.",
      zh: "ä¿®æ”¹å‡ºåº“å•æ—¶å¿…é¡»ä¸Šä¼ å‡­è¯ã€‚",
    };
    throw err;
  }

  if (config.require_otp) {
    if (!input.otp) {
      const err = new Error("Ma xac thuc OTP la bat buoc.") as Error & {
        statusCode: number;
        messages: Record<string, string>;
      };
      err.statusCode = 400;
      err.messages = {
        vi: "Ma xac thuc OTP la bat buoc.",
        zh: "éªŒè¯ç æ˜¯å¿…éœ€çš„ã€‚",
      };
      throw err;
    }
    const isOtpValid = await verifyMfa(userId, input.otp);
    if (!isOtpValid) {
      const err = new Error(
        "Ma xac thuc OTP khong hop le hoac da het han.",
      ) as Error & { statusCode: number; messages: Record<string, string> };
      err.statusCode = 400;
      err.messages = {
        vi: "Ma xac thuc OTP khong hop le hoac da het han.",
        zh: "éªŒè¯ç æ— æ•ˆæˆ–å·²è¿‡æœŸã€‚",
      };
      throw err;
    }
  }

  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherDoc = await voucherRef.get();
  if (!voucherDoc.exists) {
    const err = new Error("Khong tim thay phieu xuat kho.") as Error & {
      statusCode: number;
      messages: Record<string, string>;
    };
    err.statusCode = 404;
    err.messages = {
      vi: "Khong tim thay phieu xuat kho.",
      zh: "æ‰¾ä¸åˆ°å‡ºåº“å•ã€‚",
    };
    throw err;
  }

  const oldVoucher = voucherDoc.data() as ExportVoucher;
  assertVoucherAccess(authorization, "vouchers.write", oldVoucher.warehouse_id);
  await assertVoucherItemLocations(
    input.warehouse_id,
    input.items.map((item) => item.warehouse_location_id),
  );
  if (oldVoucher.creator_id !== userId) {
    const err = new Error(
      "Ban khong co quyen sua phieu xuat kho nay.",
    ) as Error & { statusCode: number; messages: Record<string, string> };
    err.statusCode = 403;
    err.messages = {
      vi: "Ban khong co quyen sua phieu xuat kho nay.",
      zh: "æ‚¨æ²¡æœ‰æƒé™ä¿®æ”¹æ­¤å‡ºåº“å•ã€‚",
    };
    throw err;
  }

  const allowedStatuses = [
    ExportVoucherStatus.DRAFT,
    ExportVoucherStatus.PENDING_APPROVAL,
    ExportVoucherStatus.REJECTED,
  ];
  if (!allowedStatuses.includes(oldVoucher.status)) {
    const err = new Error(
      "Chi co the sua phieu dang cho duyet hoac bi tu choi.",
    ) as Error & { statusCode: number; messages: Record<string, string> };
    err.statusCode = 400;
    err.messages = {
      vi: "Chi co the sua phieu dang cho duyet hoac bi tu choi.",
      zh: "åªèƒ½ä¿®æ”¹å¾…å®¡æ‰¹æˆ–å·²æ‹’ç»çš„å•æ®ã€‚",
    };
    throw err;
  }

  const now = new Date();
  const actionTime = input.action_time ? new Date(input.action_time) : now;
  const newVoucher: Partial<ExportVoucher> = {
    warehouse_id: input.warehouse_id,
    export_type: input.export_type,
    reference_id: input.reference_id ?? null,
    reference_type: input.reference_type ?? null,
    recipient_name: input.recipient_name ?? null,
    recipient_department: input.recipient_department ?? null,
    notes: input.notes ?? null,
    attachment_urls: input.attachment_urls ?? [],
    status: ExportVoucherStatus.PENDING_APPROVAL,
    approver_id: null,
    approved_at: null,
    updated_at: now,
    sync_time: now,
    action_time: actionTime,
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

  const batch = db.batch();
  batch.update(voucherRef, newVoucher);

  const oldItemsSnap = await voucherRef.collection("items").get();
  for (const doc of oldItemsSnap.docs) {
    batch.update(doc.ref, { is_deleted: true });
  }
  for (const item of items) {
    batch.set(voucherRef.collection("items").doc(item.id), item);
  }

  const oldApprovalsSnap = await db
    .collection("pending_approvals")
    .where("entity_type", "==", "EXPORT_VOUCHER")
    .where("entity_id", "==", voucherId)
    .get();
  for (const doc of oldApprovalsSnap.docs) {
    if (doc.data().status !== "PENDING") continue;
    batch.update(doc.ref, {
      status: "CANCELLED",
      approver_id: userId,
      approved_at: now,
      rejected_reason: "Superseded by voucher edit",
      action_time: actionTime,
      sync_time: now,
    });
  }

  await batch.commit();

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: input.warehouse_id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: oldVoucher as unknown as Record<string, unknown>,
    new_value: newVoucher as unknown as Record<string, unknown>,
    action_time: actionTime,
  });

  try {
    let creatorName: string | undefined;
    try {
      const userDoc = await db.collection("users").doc(userId).get();
      if (userDoc.exists) {
        const u = userDoc.data();
        creatorName = u?.full_name || u?.email || undefined;
      }
    } catch {}

    const approvals = await approvalService.createApprovalsForEntity(
      "EXPORT_VOUCHER",
      voucherId,
      input.warehouse_id,
      userId,
      { voucher_number: oldVoucher.voucher_number, creator_name: creatorName },
    );

    if (approvals.length === 0) {
      await onApprovalCompleted(voucherId, "SYSTEM_AUTO_APPROVE");
    }
  } catch (error) {
    console.error("[exportVoucherService] Approval recreation failed:", error);
  }

  return { ...oldVoucher, ...newVoucher } as ExportVoucher;
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// STATE MACHINE â€” Callbacks
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Called when approval is completed.
 * CRITICAL: Pre-checks ATP before advancing to APPROVED.
 * If ATP insufficient â†’ throws 400, voucher stays PENDING_APPROVAL.
 */
