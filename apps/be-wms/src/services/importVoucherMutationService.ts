import {
  AuditAction,
  ImportVoucherStatus,
  type ImportVoucher,
  type ImportVoucherItem,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";
import * as approvalService from "./approvalService.js";
import { logAudit } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import type { UpdateImportVoucherInput } from "./importVoucherSchemas.js";
import { verifyMfa } from "./mfaService.js";
import { getConfigForEntity } from "./processConfigService.js";
import {
  assertVoucherAccess,
  assertVoucherItemLocations,
} from "./voucherAccessPolicy.js";

export const updateImportVoucher = async (
  voucherId: string,
  input: UpdateImportVoucherInput,
  userId: string,
  authorization: AuthorizationService,
): Promise<ImportVoucher> => {
  assertVoucherAccess(authorization, "vouchers.write", input.warehouse_id);
  const config = await getConfigForEntity("IMPORT_VOUCHER", input.warehouse_id);

  if (
    config.require_evidence &&
    (!input.attachment_urls || input.attachment_urls.length === 0)
  ) {
    const err = new Error(
      "Báº¯t buá»™c táº£i lÃªn chá»©ng tá»« (evidence) khi sá»­a phiáº¿u nháº­p kho.",
    ) as Error & { statusCode: number; messages: Record<string, string> };
    err.statusCode = 400;
    err.messages = {
      vi: "Báº¯t buá»™c táº£i lÃªn chá»©ng tá»« (evidence) khi sá»­a phiáº¿u nháº­p kho.",
      zh: "ä¿®æ”¹å…¥åº“å•æ—¶å¿…é¡»ä¸Šä¼ å‡­è¯ (evidence)ã€‚",
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

  const voucherDoc = await db
    .collection("import_vouchers")
    .doc(voucherId)
    .get();
  if (!voucherDoc.exists) {
    const err = new Error("KhÃ´ng tÃ¬m tháº¥y phiáº¿u nháº­p kho.") as Error & {
      statusCode: number;
      messages: Record<string, string>;
    };
    err.statusCode = 404;
    err.messages = {
      vi: "KhÃ´ng tÃ¬m tháº¥y phiáº¿u nháº­p kho.",
      zh: "æ‰¾ä¸åˆ°å…¥åº“å•ã€‚",
    };
    throw err;
  }

  const oldVoucher = voucherDoc.data() as ImportVoucher;
  assertVoucherAccess(authorization, "vouchers.write", oldVoucher.warehouse_id);
  await assertVoucherItemLocations(
    input.warehouse_id,
    input.items.map((item) => item.warehouse_location_id),
  );

  if (oldVoucher.creator_id !== userId) {
    const err = new Error(
      "Báº¡n khÃ´ng cÃ³ quyá»n sá»­a phiáº¿u nháº­p kho nÃ y.",
    ) as Error & { statusCode: number; messages: Record<string, string> };
    err.statusCode = 403;
    err.messages = {
      vi: "Báº¡n khÃ´ng cÃ³ quyá»n sá»­a phiáº¿u nháº­p kho nÃ y.",
      zh: "æ‚¨æ²¡æœ‰æƒé™ä¿®æ”¹æ­¤å…¥åº“å•ã€‚",
    };
    throw err;
  }

  const allowedStatuses = [
    ImportVoucherStatus.DRAFT,
    ImportVoucherStatus.PENDING_APPROVAL,
    ImportVoucherStatus.REJECTED,
  ];
  if (!allowedStatuses.includes(oldVoucher.status)) {
    const err = new Error(
      "Chá»‰ cÃ³ thá»ƒ sá»­a phiáº¿u Ä‘ang chá» duyá»‡t hoáº·c bá»‹ tá»« chá»‘i.",
    ) as Error & { statusCode: number; messages: Record<string, string> };
    err.statusCode = 400;
    err.messages = {
      vi: "Chá»‰ cÃ³ thá»ƒ sá»­a phiáº¿u Ä‘ang chá» duyá»‡t hoáº·c bá»‹ tá»« chá»‘i.",
      zh: "åªèƒ½ä¿®æ”¹å¾…å®¡æ‰¹æˆ–å·²æ‹’ç»çš„å•æ®ã€‚",
    };
    throw err;
  }

  const now = new Date();
  const actionTime = input.action_time ? new Date(input.action_time) : now;

  const newVoucher: Partial<ImportVoucher> = {
    warehouse_id: input.warehouse_id,
    supplier_name: input.supplier_name,
    purchase_order_id: input.purchase_order_id ?? null,
    notes: input.notes ?? null,
    attachment_urls: input.attachment_urls ?? [],
    status: ImportVoucherStatus.PENDING_APPROVAL,
    updated_at: now,
    sync_time: now,
    action_time: actionTime,
    approver_id: null,
    approved_at: null,
  };

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

  const batch = db.batch();

  // update voucher
  batch.update(db.collection("import_vouchers").doc(voucherId), newVoucher);

  // delete old items
  const oldItemsSnap = await db
    .collection("import_vouchers")
    .doc(voucherId)
    .collection("items")
    .get();
  for (const doc of oldItemsSnap.docs) {
    batch.update(doc.ref, { is_deleted: true, updated_at: now });
  }

  // set new items
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

  // Cancel old approvals
  const oldApprovalsSnap = await db
    .collection("pending_approvals")
    .where("entity_type", "==", "IMPORT_VOUCHER")
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
    entity_type: "IMPORT_VOUCHER",
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
      "IMPORT_VOUCHER",
      voucherId,
      input.warehouse_id,
      userId,
      { voucher_number: oldVoucher.voucher_number, creator_name: creatorName },
    );

    if (approvals.length === 0) {
      await db.collection("import_vouchers").doc(voucherId).update({
        status: ImportVoucherStatus.APPROVED,
        updated_at: new Date(),
      });
    }
  } catch (error) {
    console.error("[importVoucherService] Approval recreation failed:", error);
  }

  return { ...oldVoucher, ...newVoucher } as ImportVoucher;
};
