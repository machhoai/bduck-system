/**
 * Import Voucher Service — Fixed Pipeline State Machine
 *
 * ═══════════════════════════════════════════════════════════════
 * REPLACES: Dynamic Workflow Engine integration.
 *
 * STATE MACHINE:
 *   DRAFT → PENDING_APPROVAL → APPROVED → RECEIVING → COMPLETED
 *                            ↘ REJECTED → DRAFT (resubmit)
 *                                       → CANCELLED
 *
 * DESIGN DECISIONS:
 * 1. Status transitions are explicit — no DAG traversal.
 * 2. Approval is handled by approvalService (Fixed Pipeline).
 * 3. Inventory update (ATP) is called DIRECTLY — no registry.
 * 4. Self-Approval Block enforced by approvalService.
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  ImportVoucherStatus,
  ItemCondition,
  AuditAction,
} from "@bduck/shared-types";
import type { ImportVoucher, ImportVoucherItem } from "@bduck/shared-types";
import * as approvalService from "./approvalService.js";
import { logAudit } from "./auditService.js";

// ─────────────────────────────────────────────
// ZOD SCHEMAS — Input validation (LUẬT THÉP)
// ─────────────────────────────────────────────

const importVoucherItemSchema = z.object({
  product_id: z.string().uuid(),
  warehouse_location_id: z.string().uuid(),
  expected_quantity: z.number().int().positive(),
  actual_quantity: z.number().int().min(0).optional().default(0),
  unit_price: z.number().min(0),
  condition: z.nativeEnum(ItemCondition),
  notes: z.string().max(500).nullable().optional(),
});

export const createImportVoucherSchema = z.object({
  warehouse_id: z.string().uuid(),
  supplier_name: z.string().min(1).max(200),
  purchase_order_id: z.string().uuid().nullable().optional(),
  items: z.array(importVoucherItemSchema).min(1),
  notes: z.string().max(1000).nullable().optional(),
  /** Firebase Storage download URLs for attached documents */
  attachment_urls: z.array(z.string().url()).max(10).optional().default([]),
  /** ISO — client offline time */
  action_time: z.string().datetime().optional(),
});

export type CreateImportVoucherInput = z.infer<
  typeof createImportVoucherSchema
>;

// ─────────────────────────────────────────────
// SERVICE — createImportVoucher
// ─────────────────────────────────────────────

/**
 * Creates an Import Voucher, writes audit log, and triggers
 * the Fixed Pipeline approval chain.
 *
 * Flow:
 * 1. Create voucher + items in Firestore (batch)
 * 2. Set status to PENDING_APPROVAL
 * 3. Create approval records via approvalService
 * 4. Write audit log
 *
 * @param input  Validated input from the controller
 * @param userId Authenticated user ID from JWT middleware
 * @returns The created voucher (without items — queried separately)
 */
export const createImportVoucher = async (
  input: CreateImportVoucherInput,
  userId: string,
): Promise<ImportVoucher> => {
  const now = new Date();
  const actionTime = input.action_time ? new Date(input.action_time) : now;
  const voucherId = randomUUID();
  const voucherNumber = generateVoucherNumber();

  // ── 1. Build voucher document ──
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

  // ── 5. Create approval records (Fixed Pipeline) ──
  try {
    const approvals = await approvalService.createApprovalsForEntity(
      "IMPORT_VOUCHER",
      voucherId,
      voucher.warehouse_id,
      userId,
    );

    // If no approval chain configured → auto-advance to APPROVED
    if (approvals.length === 0) {
      await db.collection("import_vouchers").doc(voucherId).update({
        status: ImportVoucherStatus.APPROVED,
        updated_at: new Date(),
      });
    }
  } catch (error) {
    // Log but don't fail the voucher creation.
    // Approval records can be re-created manually.
    console.error(
      "[importVoucherService] Approval creation failed:",
      error,
    );
  }

  return voucher;
};

// ─────────────────────────────────────────────
// STATE MACHINE — Callbacks
// ─────────────────────────────────────────────

/**
 * Called by approvalController when all approval levels are completed.
 * Advances voucher from PENDING_APPROVAL → APPROVED.
 */
export async function onApprovalCompleted(
  voucherId: string,
  approverId: string,
): Promise<void> {
  const now = new Date();
  await db.collection("import_vouchers").doc(voucherId).update({
    status: ImportVoucherStatus.APPROVED,
    approver_id: approverId,
    approved_at: now,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "IMPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: null,
    action: AuditAction.APPROVE,
    user_id: approverId,
    old_value: { status: ImportVoucherStatus.PENDING_APPROVAL },
    new_value: { status: ImportVoucherStatus.APPROVED },
  });
}

/**
 * Called by approvalController when an approval is rejected.
 * Advances voucher from PENDING_APPROVAL → REJECTED.
 */
export async function onApprovalRejected(
  voucherId: string,
  rejectorId: string,
  reason: string,
): Promise<void> {
  const now = new Date();
  await db.collection("import_vouchers").doc(voucherId).update({
    status: ImportVoucherStatus.REJECTED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "IMPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: null,
    action: AuditAction.REJECT,
    user_id: rejectorId,
    old_value: { status: ImportVoucherStatus.PENDING_APPROVAL },
    new_value: { status: ImportVoucherStatus.REJECTED, reason },
  });
}

/**
 * Called when receiving session data is saved and user completes receiving.
 * Advances voucher from APPROVED → RECEIVING.
 */
export async function startReceiving(voucherId: string): Promise<void> {
  const now = new Date();
  await db.collection("import_vouchers").doc(voucherId).update({
    status: ImportVoucherStatus.RECEIVING,
    updated_at: now,
    sync_time: now,
  });
}

/**
 * Called when receiving session is completed and inventory needs updating.
 * Advances voucher from RECEIVING → COMPLETED.
 * Calls updateInventoryATP DIRECTLY (no registry).
 */
export async function completeReceiving(
  voucherId: string,
  userId: string,
): Promise<void> {
  // Import dynamically to avoid circular dependency
  const { updateInventoryATP } = await import("./actions/updateInventoryATP.js");

  // Call ATP update directly — no registry lookup
  await updateInventoryATP(
    {},
    {
      instanceId: `direct_${voucherId}`,
      entityPayload: {
        voucher_id: voucherId,
        entity_type: "IMPORT_VOUCHER",
      },
      userId,
    },
  );

  // Advance status to COMPLETED
  const now = new Date();
  await db.collection("import_vouchers").doc(voucherId).update({
    status: ImportVoucherStatus.COMPLETED,
    updated_at: now,
    sync_time: now,
  });

  await logAudit({
    entity_type: "IMPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id: null,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: { status: ImportVoucherStatus.RECEIVING },
    new_value: { status: ImportVoucherStatus.COMPLETED },
  });
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Generate sequential voucher number: IMP-YYYYMMDD-XXX
 * In production, use Firestore counters or Cloud Functions
 * for guaranteed uniqueness. This is a simplified version.
 */
function generateVoucherNumber(): string {
  const today = new Date();
  const datePart = today
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, "");
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `IMP-${datePart}-${seq}`;
}
