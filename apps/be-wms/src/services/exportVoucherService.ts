/**
 * Export Voucher Service — Fixed Pipeline State Machine
 *
 * ═══════════════════════════════════════════════════════════════
 * STATE MACHINE:
 *   DRAFT → PENDING_APPROVAL → APPROVED → PICKING → SHIPPED → COMPLETED
 *                             ↘ REJECTED → DRAFT (resubmit)
 *                                        → CANCELLED
 *
 * CRITICAL:
 * - ATP pre-check during onApprovalCompleted (HARD BLOCK if insufficient)
 * - ATP deduction during completePicking (Firestore Transaction)
 * - No negative stock allowed at any point
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  ExportVoucherStatus,
  ExportType,
  ExportReferenceType,
  AuditAction,
} from "@bduck/shared-types";
import type { ExportVoucher, ExportVoucherItem } from "@bduck/shared-types";
import * as approvalService from "./approvalService.js";
import { logAudit } from "./auditService.js";
import { getConfigForEntity } from "./processConfigService.js";
import { verifyMfa } from "./mfaService.js";

// ─────────────────────────────────────────────
// ZOD SCHEMAS — Input validation (LUẬT THÉP)
// ─────────────────────────────────────────────

const exportVoucherItemSchema = z.object({
  product_id: z.string().uuid(),
  warehouse_location_id: z.string().uuid(),
  quantity: z.number().int().positive(),
  unit_price: z.number().min(0),
  notes: z.string().max(500).nullable().optional(),
});

export const createExportVoucherSchema = z.object({
  warehouse_id: z.string().uuid(),
  export_type: z.nativeEnum(ExportType),
  reference_id: z.string().uuid().nullable().optional(),
  reference_type: z.nativeEnum(ExportReferenceType).nullable().optional(),
  recipient_name: z.string().max(200).nullable().optional(),
  recipient_department: z.string().max(200).nullable().optional(),
  items: z.array(exportVoucherItemSchema).min(1),
  notes: z.string().max(1000).nullable().optional(),
  attachment_urls: z.array(z.string().url()).max(10).optional().default([]),
  action_time: z.string().datetime().optional(),
  otp: z.string().optional(),
});

export type CreateExportVoucherInput = z.infer<
  typeof createExportVoucherSchema
>;

export const updateExportVoucherSchema = createExportVoucherSchema;
export type UpdateExportVoucherInput = CreateExportVoucherInput;

// ─────────────────────────────────────────────
// SERVICE — createExportVoucher
// ─────────────────────────────────────────────

export const createExportVoucher = async (
  input: CreateExportVoucherInput,
  userId: string,
): Promise<ExportVoucher> => {
  const config = await getConfigForEntity("EXPORT_VOUCHER", input.warehouse_id);

  if (
    config.require_evidence &&
    (!input.attachment_urls || input.attachment_urls.length === 0)
  ) {
    const err = new Error(
      "Bắt buộc tải lên chứng từ (evidence) khi tạo phiếu xuất kho.",
    ) as Error & { statusCode: number; messages: Record<string, string> };
    err.statusCode = 400;
    err.messages = {
      vi: "Bắt buộc tải lên chứng từ (evidence) khi tạo phiếu xuất kho.",
      zh: "创建出库单时必须上传凭证 (evidence)。",
    };
    throw err;
  }

  if (config.require_otp) {
    if (!input.otp) {
      const err = new Error("Mã xác thực (OTP) là bắt buộc.") as Error & {
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
      // No chain → auto-advance (includes ATP pre-check)
      await onApprovalCompleted(voucherId, "SYSTEM_AUTO_APPROVE");
    }
  } catch (error) {
    console.error("[exportVoucherService] Approval creation failed:", error);
  }

  return voucher;
};

export const updateExportVoucher = async (
  voucherId: string,
  input: UpdateExportVoucherInput,
  userId: string,
): Promise<ExportVoucher> => {
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
      zh: "修改出库单时必须上传凭证。",
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
        zh: "验证码是必需的。",
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
        zh: "验证码无效或已过期。",
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
      zh: "找不到出库单。",
    };
    throw err;
  }

  const oldVoucher = voucherDoc.data() as ExportVoucher;
  if (oldVoucher.creator_id !== userId) {
    const err = new Error(
      "Ban khong co quyen sua phieu xuat kho nay.",
    ) as Error & { statusCode: number; messages: Record<string, string> };
    err.statusCode = 403;
    err.messages = {
      vi: "Ban khong co quyen sua phieu xuat kho nay.",
      zh: "您没有权限修改此出库单。",
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
      zh: "只能修改待审批或已拒绝的单据。",
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

// ─────────────────────────────────────────────
// STATE MACHINE — Callbacks
// ─────────────────────────────────────────────

/**
 * Called when approval is completed.
 * CRITICAL: Pre-checks ATP before advancing to APPROVED.
 * If ATP insufficient → throws 400, voucher stays PENDING_APPROVAL.
 */
export async function onApprovalCompleted(
  voucherId: string,
  approverId: string,
): Promise<void> {
  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();
  if (!voucherSnap.exists) return;

  const voucher = voucherSnap.data() as ExportVoucher;
  if (
    voucher.reference_type === ExportReferenceType.EXTERNAL_QUEUE_BATCH &&
    voucher.reference_id
  ) {
    const { finalizeApprovedBatchFromVoucher } =
      await import("./externalScanService.js");
    await finalizeApprovedBatchFromVoucher(voucherId, approverId);
    return;
  }

  // ATP Pre-check: read all items and verify inventory
  await validateAtpSufficiency(voucherId);

  const now = new Date();
  await voucherRef.update({
    status: ExportVoucherStatus.APPROVED,
    approver_id: approverId,
    approved_at: now,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.APPROVE,
    user_id: approverId,
    old_value: { status: ExportVoucherStatus.PENDING_APPROVAL },
    new_value: { status: ExportVoucherStatus.APPROVED },
  });
}

export async function onApprovalRejected(
  voucherId: string,
  rejectorId: string,
  reason: string,
): Promise<void> {
  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();
  if (!voucherSnap.exists) return;
  const voucher = voucherSnap.data() as ExportVoucher;
  const now = new Date();

  await voucherRef.update({
    status: ExportVoucherStatus.REJECTED,
    updated_at: now,
    sync_time: now,
  });

  if (
    voucher.reference_type === ExportReferenceType.EXTERNAL_QUEUE_BATCH &&
    voucher.reference_id
  ) {
    const { returnBatchForRevisionFromVoucher } =
      await import("./externalScanService.js");
    await returnBatchForRevisionFromVoucher(voucherId, rejectorId, reason);
  }

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.REJECT,
    user_id: rejectorId,
    old_value: { status: ExportVoucherStatus.PENDING_APPROVAL },
    new_value: { status: ExportVoucherStatus.REJECTED, reason },
  });
}

/**
 * Called when the creator cancels their own voucher.
 * Advances voucher from PENDING_APPROVAL → CANCELLED.
 */
export async function onApprovalCancelled(
  voucherId: string,
  userId: string,
  reason?: string | null,
): Promise<void> {
  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();
  const voucher = voucherSnap.exists
    ? (voucherSnap.data() as ExportVoucher)
    : null;
  const now = new Date();
  await voucherRef.update({
    status: ExportVoucherStatus.CANCELLED,
    updated_at: now,
    sync_time: now,
  });

  if (
    voucher?.reference_type === ExportReferenceType.EXTERNAL_QUEUE_BATCH &&
    voucher.reference_id
  ) {
    const { cancelBatchFromVoucher } = await import("./externalScanService.js");
    await cancelBatchFromVoucher(
      voucherId,
      userId,
      reason || "External queue export voucher cancelled",
    );
  }

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: voucher?.warehouse_id ?? null,
    action: AuditAction.CANCEL,
    user_id: userId,
    old_value: { status: ExportVoucherStatus.PENDING_APPROVAL },
    new_value: {
      status: ExportVoucherStatus.CANCELLED,
      reason: reason || null,
    },
  });
}

/** APPROVED → PICKING (thủ kho bắt đầu soạn hàng) */
export async function startPicking(voucherId: string): Promise<void> {
  const now = new Date();
  await db.collection("export_vouchers").doc(voucherId).update({
    status: ExportVoucherStatus.PICKING,
    updated_at: now,
    sync_time: now,
  });

  // Mirror to Transfer Order if linked
  try {
    const { syncExportStatus } = await import("./transferOrderService.js");
    await syncExportStatus(voucherId, ExportVoucherStatus.PICKING);
  } catch {
    /* no linked transfer */
  }
}

/**
 * PICKING → SHIPPED
 * Deducts ATP via Firestore Transaction.
 */
export async function completePicking(
  voucherId: string,
  userId: string,
): Promise<void> {
  const { deductInventoryATP } =
    await import("./actions/deductInventoryATP.js");
  await deductInventoryATP(voucherId, userId);

  const now = new Date();
  await db.collection("export_vouchers").doc(voucherId).update({
    status: ExportVoucherStatus.SHIPPED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: null,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: ExportVoucherStatus.PICKING },
    new_value: { status: ExportVoucherStatus.SHIPPED },
  });

  // Mirror to Transfer Order if linked
  try {
    const { syncExportStatus } = await import("./transferOrderService.js");
    await syncExportStatus(voucherId, ExportVoucherStatus.SHIPPED);
  } catch {
    /* no linked transfer */
  }
}

/** SHIPPED → COMPLETED (kế toán xác nhận) */
export async function completeExport(
  voucherId: string,
  userId: string,
): Promise<void> {
  const now = new Date();
  await db.collection("export_vouchers").doc(voucherId).update({
    status: ExportVoucherStatus.COMPLETED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: null,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: ExportVoucherStatus.SHIPPED },
    new_value: { status: ExportVoucherStatus.COMPLETED },
  });
}

// ─────────────────────────────────────────────
// ATP VALIDATION — Hard Block
// ─────────────────────────────────────────────

/**
 * Validates that warehouse has sufficient ATP for all items.
 * Called during onApprovalCompleted BEFORE advancing to APPROVED.
 *
 * @throws 400 with specific product info if ATP insufficient
 */
async function validateAtpSufficiency(voucherId: string): Promise<void> {
  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();
  if (!voucherSnap.exists) return;

  const voucher = voucherSnap.data()!;
  const warehouseId = voucher.warehouse_id as string;

  const itemsSnap = await voucherRef
    .collection("items")
    .where("is_deleted", "==", false)
    .get();

  for (const doc of itemsSnap.docs) {
    const item = doc.data();
    const requestedQty = item.quantity as number;
    const productId = item.product_id as string;
    const locationId = item.warehouse_location_id as string;

    // Query inventory for this product at this location
    // CRITICAL: Filter is_deleted client-side to avoid composite index requirement
    const invSnapRaw = await db
      .collection("inventory")
      .where("warehouse_id", "==", warehouseId)
      .where("warehouse_location_id", "==", locationId)
      .where("product_id", "==", productId)
      .limit(5)
      .get();
    const activeInvDocs = invSnapRaw.docs.filter(
      (d) => d.data().is_deleted !== true,
    );

    const currentAtp =
      activeInvDocs.length === 0
        ? 0
        : (activeInvDocs[0].data().atp_quantity as number) || 0;

    if (currentAtp < requestedQty) {
      // Resolve product name + location name for human-readable error
      let productLabel = productId;
      let locationLabel = locationId;
      try {
        const [productSnap, locationSnap] = await Promise.all([
          db.collection("products").doc(productId).get(),
          db.collection("warehouse_locations").doc(locationId).get(),
        ]);
        if (productSnap.exists) {
          const pData = productSnap.data()!;
          productLabel = `${pData.name || ""} (${pData.code || productId})`;
        }
        if (locationSnap.exists) {
          const lData = locationSnap.data()!;
          locationLabel = `${lData.name || ""} (${lData.code || locationId})`;
        }
      } catch {
        // Fallback to IDs if name resolution fails
      }

      throw Object.assign(new Error("Insufficient ATP"), {
        statusCode: 400,
        messages: {
          vi: `Không đủ tồn kho khả dụng. Sản phẩm: ${productLabel}, Vị trí: ${locationLabel}, ATP hiện tại: ${currentAtp}, Yêu cầu: ${requestedQty}.`,
          zh: `可用库存不足。产品：${productLabel}，库位：${locationLabel}，当前ATP：${currentAtp}，请求：${requestedQty}。`,
        },
      });
    }
  }
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

function generateVoucherNumber(): string {
  const today = new Date();
  const datePart = today.toISOString().slice(0, 10).replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `EXP-${datePart}-${seq}`;
}
