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
      "Báº¯t buá»™c táº£i lÃªn chá»©ng tá»« (evidence) khi táº¡o phiáº¿u nháº­p kho.",
    ) as Error & { statusCode: number; messages: Record<string, string> };
    err.statusCode = 400;
    err.messages = {
      vi: "Báº¯t buá»™c táº£i lÃªn chá»©ng tá»« (evidence) khi táº¡o phiáº¿u nháº­p kho.",
      zh: "åˆ›å»ºå…¥åº“å•æ—¶å¿…é¡»ä¸Šä¼ å‡­è¯ (evidence)ã€‚",
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

  // â”€â”€ 1. Build voucher document â”€â”€
  const voucher: ImportVoucher = {
    id: voucherId,
    voucher_number: voucherNumber,
    warehouse_id: input.warehouse_id,
    supplier_name: input.supplier_name,
    purchase_order_id: input.purchase_order_id ?? null,
    status: ImportVoucherStatus.PENDING_APPROVAL,
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

  // â”€â”€ 2. Build item documents â”€â”€
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

  // â”€â”€ 3. Write to Firestore (batch for atomicity) â”€â”€
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

  await batch.commit();

  // â”€â”€ 4. Write audit log (ISO 9001) â”€â”€
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

  // â”€â”€ 5. Create approval records (Fixed Pipeline) â”€â”€
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
      // Non-critical: approval still works without name
    }

    const approvals = await approvalService.createApprovalsForEntity(
      "IMPORT_VOUCHER",
      voucherId,
      voucher.warehouse_id,
      userId,
      { voucher_number: voucherNumber, creator_name: creatorName },
    );

    // If no approval chain configured â†’ auto-advance to APPROVED
    if (approvals.length === 0) {
      await db.collection("import_vouchers").doc(voucherId).update({
        status: ImportVoucherStatus.APPROVED,
        updated_at: new Date(),
      });
    }
  } catch (error) {
    // Log but don't fail the voucher creation.
    // Approval records can be re-created manually.
    console.error("[importVoucherService] Approval creation failed:", error);
  }

  return voucher;
};

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// STATE MACHINE â€” Callbacks
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Called by approvalController when all approval levels are completed.
 * Advances voucher from PENDING_APPROVAL â†’ APPROVED.
 */

function generateVoucherNumber(): string {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `IMP-${datePart}-${seq}`;
}
