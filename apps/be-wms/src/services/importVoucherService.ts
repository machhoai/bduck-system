/**
 * Import Voucher Service — Minimal Workflow Integration Hook
 *
 * ═══════════════════════════════════════════════════════════════
 * This service handles ONLY the creation of Import Vouchers
 * and the trigger to the Workflow Engine.
 *
 * DESIGN DECISIONS:
 * 1. Voucher status stays PENDING — the engine is decoupled.
 *    Only a SYSTEM_ACTION node of type "CHANGE_STATUS" may change it.
 * 2. entity_payload is computed here and passed to startWorkflow()
 *    so ConditionNodes can evaluate without DB lookups.
 * 3. Self-Approval Block: creator_id will never equal approver_id
 *    because approver_id starts as null. The workflow engine's
 *    APPROVAL node assigns the approver dynamically.
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import { randomUUID } from "crypto";
import { z } from "zod";
import {
  ImportVoucherStatus,
  ItemCondition,
  AuditAction,
  ApprovalEntityType,
} from "@bduck/shared-types";
import type { ImportVoucher, ImportVoucherItem } from "@bduck/shared-types";
import { startWorkflow } from "./workflowEngineService.js";
import { logAudit } from "./auditService.js";

// ─────────────────────────────────────────────
// ZOD SCHEMAS — Input validation (LUẬT THÉP)
// ─────────────────────────────────────────────

const importVoucherItemSchema = z.object({
  product_id: z.string().uuid(),
  warehouse_location_id: z.string().uuid(),
  expected_quantity: z.number().int().positive(),
  actual_quantity: z.number().int().min(0),
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
 * the Workflow Engine for the IMPORT_VOUCHER entity type.
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
    status: ImportVoucherStatus.DRAFT,
    creator_id: userId,
    approver_id: null, // Self-Approval Block: approver is assigned by engine
    approved_at: null,
    action_time: actionTime,
    sync_time: now,
    notes: input.notes ?? null,
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
    entity_type: ApprovalEntityType.IMPORT_VOUCHER,
    entity_id: voucherId,
    warehouse_id: voucher.warehouse_id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: voucher as unknown as Record<string, unknown>,
    action_time: actionTime,
  });

  // ── 5. Build entity_payload for ConditionNode evaluation ──
  const entityPayload = buildEntityPayload(voucher, items);

  // ── 6. Trigger Workflow Engine ──
  try {
    await startWorkflow(
      ApprovalEntityType.IMPORT_VOUCHER,
      voucherId,
      voucher.warehouse_id,
      userId,
      entityPayload,
    );
  } catch (error) {
    // Log but don't fail the voucher creation.
    // The voucher is saved; workflow can be re-triggered manually.
    console.error(
      "[importVoucherService] Workflow trigger failed:",
      error,
    );
  }

  return voucher;
};

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Compute aggregate payload for the Condition Evaluator.
 * This payload is passed to `startWorkflow()` and threaded
 * through the entire DAG traversal.
 */
function buildEntityPayload(
  voucher: ImportVoucher,
  items: ImportVoucherItem[],
): Record<string, unknown> {
  const totalAmount = items.reduce(
    (sum, i) => sum + i.unit_price * i.expected_quantity,
    0,
  );
  const totalExpectedQty = items.reduce(
    (sum, i) => sum + i.expected_quantity,
    0,
  );

  return {
    voucher_id: voucher.id,
    voucher_number: voucher.voucher_number,
    warehouse_id: voucher.warehouse_id,
    supplier_name: voucher.supplier_name,
    total_amount: totalAmount,
    expected_quantity: totalExpectedQty,
    item_count: items.length,
    status: voucher.status,
  };
}

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
