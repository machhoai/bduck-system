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
 * - Assignment validation (CREATOR/ROLE check) is enforced HERE
 *   in the service layer (not in controller).
 *
 * SECURITY:
 * - Input validated via Zod
 * - User must be authenticated (JWT middleware)
 * - Step assignment validated via ProcessConfig
 * - Audit trail written for ISO 9001 compliance
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import { z } from "zod";
import { AuditAction } from "@bduck/shared-types";
import type { ProcessEntityType } from "@bduck/shared-types";
import { logAudit } from "./auditService.js";
import { getConfigForEntity } from "./processConfigService.js";
import { canPerformRoleStep, type ScopedUser } from "./scopedRoleAccess.js";
import type { AuthorizationService } from "./authorization/index.js";
import { assertVoucherAccess } from "./voucherAccessPolicy.js";

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
// TYPES — User context from controller
// ─────────────────────────────────────────────

export type StepUser = ScopedUser;

// ─────────────────────────────────────────────
// STEP ASSIGNMENT VALIDATION
// ─────────────────────────────────────────────

/**
 * Validates whether the user is authorized to perform a step
 * based on ProcessConfig.step_options.assignment_mode.
 *
 * SERVICE LAYER: All business logic stays here. Controller
 * only passes user data (id, roleIds) from req.user.
 *
 * @throws 403 if user is not authorized
 */
export async function validateStepAssignment(
  entityType: ProcessEntityType,
  warehouseId: string | null,
  stepKey: string,
  user: StepUser,
  voucherCreatorId: string,
): Promise<void> {
  const config = await getConfigForEntity(entityType, warehouseId);
  const stepOption = config.step_options?.[stepKey];

  if (!stepOption) {
    // No step config → allow by default (fallback to CREATOR behavior)
    return;
  }

  const { assignment_mode, assigned_role_id } = stepOption;

  if (assignment_mode === "CREATOR") {
    if (user.id !== voucherCreatorId) {
      const err = new Error("Unauthorized step assignment") as Error & {
        statusCode: number;
        messages: Record<string, string>;
      };
      err.statusCode = 403;
      err.messages = {
        vi: "Chỉ người tạo phiếu mới được phép thực hiện bước này.",
        zh: "只有创建者才能执行此步骤。",
      };
      throw err;
    }
  } else if (assignment_mode === "ROLE") {
    if (
      !assigned_role_id ||
      !canPerformRoleStep(user, stepOption, warehouseId)
    ) {
      const err = new Error("Unauthorized step assignment") as Error & {
        statusCode: number;
        messages: Record<string, string>;
      };
      err.statusCode = 403;
      err.messages = {
        vi: "Bạn không có đúng role trong phạm vi kho của bước này. Vui lòng kiểm tra lại phân quyền theo kho hoặc liên hệ quản trị viên.",
        zh: "您没有此步骤仓库范围内的正确角色。请检查仓库权限或联系管理员。",
      };
      throw err;
    }
  }
}

// ─────────────────────────────────────────────
// SERVICE — saveReceivingActuals
// ─────────────────────────────────────────────

/**
 * Batch-update actual_quantity on import voucher items.
 * Validates step assignment before performing any writes.
 *
 * @param voucherId  Parent import voucher ID
 * @param input      Validated input from controller
 * @param user       Authenticated user context (id + roleIds)
 */
export async function saveReceivingActuals(
  voucherId: string,
  input: SaveActualsInput,
  user: StepUser,
  authorization: AuthorizationService,
): Promise<{ updated: number }> {
  // Verify voucher exists
  const voucherRef = db.collection("import_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();

  if (!voucherSnap.exists) {
    const err = new Error("Voucher not found") as Error & {
      statusCode: number;
      messages: Record<string, string>;
    };
    err.statusCode = 404;
    err.messages = {
      vi: "Không tìm thấy phiếu nhập.",
      zh: "未找到入库单。",
    };
    throw err;
  }

  const voucher = voucherSnap.data() || {};
  assertVoucherAccess(
    authorization,
    "vouchers.write",
    typeof voucher.warehouse_id === "string" ? voucher.warehouse_id : "",
  );

  // ── Step assignment validation (Service Layer — LUẬT THÉP) ──
  await validateStepAssignment(
    "IMPORT_VOUCHER",
    typeof voucher.warehouse_id === "string" ? voucher.warehouse_id : null,
    "receiving",
    user,
    typeof voucher.creator_id === "string" ? voucher.creator_id : "",
  );

  const now = new Date();
  const actionTime = input.action_time ? new Date(input.action_time) : now;

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
    user_id: user.id,
    old_value: null,
    new_value: {
      action: "SAVE_RECEIVING_ACTUALS",
      items_updated: updatedCount,
      action_time: actionTime,
    },
  });

  return { updated: updatedCount };
}
