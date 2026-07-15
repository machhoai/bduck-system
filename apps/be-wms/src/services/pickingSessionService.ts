/**
 * Picking Session Service — Save picking actuals for export vouchers
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURE:
 * - Mirrors receivingSessionService.ts but for EXPORT flow.
 * - Saves picked_quantity for each item during picking phase.
 * - Validates step assignment (CREATOR/ROLE) via ProcessConfig.
 * - Controller passes StepUser — all business logic here.
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
// ZOD SCHEMA
// ─────────────────────────────────────────────

const pickingItemSchema = z.object({
  id: z.string().min(1),
  picked_quantity: z.number().int().min(0),
  notes: z.string().max(500).nullable().optional(),
});

export const savePickingActualsSchema = z.object({
  items: z.array(pickingItemSchema).min(1),
  action_time: z.string().datetime().optional(),
});

export type SavePickingActualsInput = z.infer<typeof savePickingActualsSchema>;

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export type StepUser = ScopedUser;

// ─────────────────────────────────────────────
// STEP ASSIGNMENT VALIDATION
// ─────────────────────────────────────────────

export async function validatePickingAssignment(
  warehouseId: string | null,
  user: StepUser,
  voucherCreatorId: string,
): Promise<void> {
  const config = await getConfigForEntity(
    "EXPORT_VOUCHER" as ProcessEntityType,
    warehouseId,
  );
  const stepOption = config.step_options?.["picking"];

  if (!stepOption) return; // No config → allow

  const { assignment_mode, assigned_role_id } = stepOption;

  if (assignment_mode === "CREATOR") {
    if (user.id !== voucherCreatorId) {
      throw Object.assign(new Error("Unauthorized"), {
        statusCode: 403,
        messages: {
          vi: "Chỉ người tạo phiếu mới được phép soạn hàng.",
          zh: "只有创建者才能执行拣货。",
        },
      });
    }
  } else if (assignment_mode === "ROLE") {
    if (
      !assigned_role_id ||
      !canPerformRoleStep(user, stepOption, warehouseId)
    ) {
      throw Object.assign(new Error("Unauthorized"), {
        statusCode: 403,
        messages: {
          vi: "Bạn không có đúng role trong phạm vi kho để soạn hàng. Vui lòng kiểm tra lại phân quyền theo kho hoặc liên hệ quản trị viên.",
          zh: "您没有此仓库范围内的正确拣货角色。请检查仓库权限或联系管理员。",
        },
      });
    }
  }
}

// ─────────────────────────────────────────────
// SERVICE — savePickingActuals
// ─────────────────────────────────────────────

export async function savePickingActuals(
  voucherId: string,
  input: SavePickingActualsInput,
  user: StepUser,
  authorization: AuthorizationService,
): Promise<{ updated: number }> {
  const voucherRef = db.collection("export_vouchers").doc(voucherId);
  const voucherSnap = await voucherRef.get();

  if (!voucherSnap.exists) {
    throw Object.assign(new Error("Voucher not found"), {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy phiếu xuất kho.",
        zh: "未找到出库单。",
      },
    });
  }

  const voucher = voucherSnap.data()!;
  assertVoucherAccess(
    authorization,
    "vouchers.write",
    typeof voucher.warehouse_id === "string" ? voucher.warehouse_id : "",
  );

  // Step assignment validation
  await validatePickingAssignment(
    typeof voucher.warehouse_id === "string" ? voucher.warehouse_id : null,
    user,
    typeof voucher.creator_id === "string" ? voucher.creator_id : "",
  );

  const now = new Date();
  const actionTime = input.action_time ? new Date(input.action_time) : now;
  const batch = db.batch();
  let updatedCount = 0;

  for (const item of input.items) {
    const itemRef = voucherRef.collection("items").doc(item.id);
    const itemSnap = await itemRef.get();

    if (!itemSnap.exists) {
      console.warn(
        `[pickingSessionService] Item ${item.id} not found. Skipping.`,
      );
      continue;
    }

    batch.update(itemRef, {
      picked_quantity: item.picked_quantity,
      notes: item.notes ?? null,
    });
    updatedCount++;
  }

  batch.update(voucherRef, { updated_at: now, sync_time: now });
  await batch.commit();

  // Audit trail
  await logAudit({
    entity_type: "EXPORT_VOUCHER",
    entity_id: voucherId,
    warehouse_id:
      typeof voucher.warehouse_id === "string" ? voucher.warehouse_id : null,
    action: AuditAction.UPDATE,
    user_id: user.id,
    old_value: null,
    new_value: {
      action: "SAVE_PICKING_ACTUALS",
      items_updated: updatedCount,
      action_time: actionTime,
    },
  });

  return { updated: updatedCount };
}
