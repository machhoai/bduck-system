/**
 * Receiving Session Service — Backend handler for saving actuals
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURE:
 * - This service receives actual_quantity values from the
 *   ReceivingSessionDrawer (frontend) and persists them
 *   to Firestore as a batch update.
 * - It does NOT change voucher status or update ATP.
 *   Those are handled by importVoucherService state machine.
 *
 * SECURITY:
 * - Input validated via Zod
 * - User must be authenticated (JWT middleware)
 * - Audit trail written for ISO 9001 compliance
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import { z } from "zod";
import { AuditAction } from "@bduck/shared-types";
import { logAudit } from "./auditService.js";

// ─────────────────────────────────────────────
// ZOD SCHEMA — Input validation
// ─────────────────────────────────────────────

const receivingItemSchema = z.object({
  id: z.string().min(1),
  actual_quantity: z.number().int().min(0),
  notes: z.string().max(500).nullable().optional(),
});

export const saveActualsSchema = z.object({
  items: z.array(receivingItemSchema).min(1),
  action_time: z.string().datetime().optional(),
});

export type SaveActualsInput = z.infer<typeof saveActualsSchema>;

// ─────────────────────────────────────────────
// SERVICE — saveReceivingActuals
// ─────────────────────────────────────────────

/**
 * Batch-update actual_quantity on import voucher items.
 *
 * @param voucherId  Parent import voucher ID
 * @param input      Validated input from controller
 * @param userId     Authenticated user from JWT
 */
export async function saveReceivingActuals(
  voucherId: string,
  input: SaveActualsInput,
  userId: string,
): Promise<{ updated: number }> {
  // Verify voucher exists
  const voucherRef = db.collection("import_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();

  if (!voucherSnap.exists) {
    const err = new Error("Voucher not found") as Error & { statusCode: number; messages: Record<string, string> };
    err.statusCode = 404;
    err.messages = {
      vi: "Không tìm thấy phiếu nhập.",
      zh: "未找到入库单。",
    };
    throw err;
  }

  const now = new Date();
  const actionTime = input.action_time ? new Date(input.action_time) : now;
  const voucher = voucherSnap.data() || {};

  // Batch update items
  const batch = db.batch();
  let updatedCount = 0;

  for (const item of input.items) {
    const itemRef = voucherRef.collection("items").doc(item.id);
    const itemSnap = await itemRef.get();

    if (!itemSnap.exists) {
      console.warn(
        `[receivingSessionService] Item ${item.id} not found. Skipping.`,
      );
      continue;
    }

    batch.update(itemRef, {
      actual_quantity: item.actual_quantity,
      notes: item.notes ?? null,
    });

    updatedCount++;
  }

  // Update voucher sync_time
  batch.update(voucherRef, {
    updated_at: now,
    sync_time: now,
  });

  await batch.commit();

  // Audit trail (ISO 9001)
  await logAudit({
    entity_type: "IMPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id:
      typeof voucher.warehouse_id === "string" ? voucher.warehouse_id : null,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: null,
    new_value: {
      action: "SAVE_RECEIVING_ACTUALS",
      items_updated: updatedCount,
      action_time: actionTime,
    },
  });

  return { updated: updatedCount };
}
