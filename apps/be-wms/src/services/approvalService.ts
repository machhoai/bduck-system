/**
 * Approval Service — Fixed Pipeline Approval Logic
 *
 * ═══════════════════════════════════════════════════════════════
 * REPLACES: Dynamic Workflow Engine's APPROVAL node execution.
 *
 * RESPONSIBILITIES:
 * 1. Create approval records based on ProcessConfig chain
 * 2. Process approve/reject actions with level advancement
 * 3. Enforce Self-Approval Block (ISO 9001 · Segregation of Duties)
 * 4. Trigger entity-specific callbacks when fully approved
 * 5. Audit trail for every approval action
 *
 * SELF-APPROVAL BLOCK (LUẬT THÉP):
 *   approver_id !== creator_id — enforced in approveLevel()
 *
 * MULTI-APPROVER:
 *   When min_approvers > 1 at a level, the system waits until
 *   that many DISTINCT approvers have approved before advancing.
 * ═══════════════════════════════════════════════════════════════
 */

import { randomUUID } from "crypto";
import { db } from "../config/firebase.js";
import { AuditAction } from "@bduck/shared-types";
import type {
  ProcessEntityType,
  ApprovalRecord,
  ApprovalLevel,
} from "@bduck/shared-types";
import * as approvalRepo from "../repositories/approvalRepository.js";
import * as configRepo from "../repositories/processConfigRepository.js";
import { logAudit } from "./auditService.js";
import { verifyMfa } from "./mfaService.js";
import {
  notifyApprovalCompleted,
  notifyInitialApprovalTasks,
  notifyNextApprovalLevel,
} from "./workflowNotificationService.js";
import {
  canActOnApprovalRecord,
  resolveStepWarehouseId,
  type ScopedUser,
} from "./scopedRoleAccess.js";

// ─────────────────────────────────────────────
// ERROR HELPERS
// ─────────────────────────────────────────────

function createError(
  statusCode: number,
  vi: string,
  zh: string,
): Error & { statusCode: number; messages: Record<string, string> } {
  const err = new Error(vi) as Error & {
    statusCode: number;
    messages: Record<string, string>;
  };
  err.statusCode = statusCode;
  err.messages = { vi, zh };
  return err;
}

// ─────────────────────────────────────────────
// CREATE APPROVALS FOR ENTITY
// ─────────────────────────────────────────────

/**
 * Creates approval records for a voucher/entity based on ProcessConfig.
 *
 * Only the FIRST active level is set to PENDING.
 * Subsequent levels are also created as PENDING but won't be acted upon
 * until the previous level is fully approved.
 *
 * @returns Created approval records
 */
export async function createApprovalsForEntity(
  entityType: ProcessEntityType,
  entityId: string,
  warehouseId: string,
  creatorId: string,
  displayInfo?: { voucher_number?: string; creator_name?: string },
  scopeInfo?: {
    sourceWarehouseId?: string | null;
    destinationWarehouseId?: string | null;
  },
): Promise<ApprovalRecord[]> {
  // ── Check auto_approve flag in ProcessConfig ──
  const config = await configRepo.findByEntityType(entityType, warehouseId);

  if (config?.auto_approve === true) {
    console.log(
      `[approvalService] auto_approve=true for ${entityType}. Skipping approval chain.`,
    );

    // Audit trail: explicitly record system auto-approve (ISO 9001)
    await logAudit({
      entity_type: entityType,
      entity_id: entityId,
      warehouse_id: warehouseId,
      action: AuditAction.APPROVE,
      user_id: "SYSTEM_AUTO_APPROVE",
      old_value: { status: "CREATED" },
      new_value: {
        status: "AUTO_APPROVED",
        reason: "auto_approve enabled in ProcessConfig",
        config_id: config.id,
      },
    });

    return []; // Triggers auto-advance in importVoucherService
  }

  const chain = await configRepo.getActiveApprovalChain(
    entityType,
    warehouseId,
  );

  console.log(
    `[approvalService] createApprovalsForEntity: entityType=${entityType}, entityId=${entityId}, warehouseId=${warehouseId}, chainLength=${chain.length}`,
  );

  if (chain.length === 0) {
    // No approval required — entity auto-advances
    console.log(
      `[approvalService] No approval chain found for ${entityType}. Auto-advancing.`,
    );
    return [];
  }

  console.log(
    `[approvalService] Approval chain:`,
    chain.map((l) => ({ level: l.level, role_id: l.role_id, label: l.label })),
  );

  const now = new Date();
  const records: ApprovalRecord[] = [];

  for (const level of chain) {
    const approvalScope = level.approval_scope ?? "ENTITY_WAREHOUSE";
    const approvalWarehouseId = resolveStepWarehouseId(
      approvalScope,
      warehouseId,
      scopeInfo?.sourceWarehouseId,
      scopeInfo?.destinationWarehouseId,
    );
    // Create min_approvers records per level (default 1)
    const count = Math.max(level.min_approvers || 1, 1);
    for (let i = 0; i < count; i++) {
      records.push({
        id: randomUUID(),
        entity_type: entityType,
        entity_id: entityId,
        warehouse_id: warehouseId,
        approval_warehouse_id: approvalWarehouseId,
        approval_scope: approvalScope,
        allow_global_fallback: level.allow_global_fallback === true,
        level: level.level,
        role_id: level.role_id,
        status: "PENDING",
        approver_id: null,
        approved_at: null,
        rejected_reason: null,
        comments: null,
        creator_id: creatorId,
        action_time: now,
        sync_time: now,
        created_at: now,
        // Denormalized display fields
        voucher_number: displayInfo?.voucher_number ?? undefined,
        creator_name: displayInfo?.creator_name ?? undefined,
      });
    }
  }

  await approvalRepo.createBatch(records);
  console.log(
    `[approvalService] Created ${records.length} pending_approval records for ${entityType}/${entityId}`,
  );

  await notifyInitialApprovalTasks(records);

  return records;
}

// ─────────────────────────────────────────────
// APPROVE LEVEL
// ─────────────────────────────────────────────

export interface ApprovalResult {
  /** Whether all levels are now approved */
  allApproved: boolean;
  /** Whether this specific level is now fully approved */
  levelCompleted: boolean;
  /** The approval record that was updated */
  record: ApprovalRecord;
}

/**
 * Process an approval action on a specific record.
 *
 * SELF-APPROVAL BLOCK (LUẬT THÉP):
 *   Throws if approver_id === record.creator_id.
 *
 * LEVEL ADVANCEMENT:
 *   1. Check if the current level is the correct "next" level to approve
 *   2. Mark this record as APPROVED
 *   3. Count approved records at this level
 *   4. If count >= min_approvers → level is completed
 *   5. If all levels completed → allApproved = true
 */
export async function approveLevel(
  approvalId: string,
  approverId: string,
  comments?: string | null,
  otp?: string | null,
  approver?: ScopedUser,
): Promise<ApprovalResult> {
  const record = await approvalRepo.findById(approvalId);

  if (!record) {
    throw createError(
      404,
      "Không tìm thấy bản ghi phê duyệt.",
      "未找到审批记录。",
    );
  }

  if (record.status !== "PENDING") {
    throw createError(
      400,
      "Bản ghi phê duyệt này đã được xử lý.",
      "该审批记录已处理。",
    );
  }

  if (approver && !canActOnApprovalRecord(approver, record)) {
    throw createError(
      403,
      "Bạn không có đúng role trong phạm vi kho của bước duyệt này. Vui lòng kiểm tra lại phân quyền theo kho hoặc liên hệ quản trị viên để được gán role phù hợp.",
      "您没有此审批步骤仓库范围内的正确角色。请检查仓库权限或联系管理员分配合适角色。",
    );
  }

  // ── SELF-APPROVAL BLOCK (Defense in Depth) ──
  if (approverId === record.creator_id) {
    throw createError(
      403,
      "Không được phép tự phê duyệt lệnh do chính mình tạo (Segregation of Duties).",
      "不允许自行审批自己创建的单据（职责分离）。",
    );
  }

  // ── OTP VERIFICATION (If required by config) ──
  const config = await configRepo.findByEntityType(
    record.entity_type,
    record.warehouse_id,
  );
  if (config?.require_otp) {
    if (!otp) {
      throw createError(
        400,
        "Mã xác thực (OTP) là bắt buộc cho thao tác này.",
        "此操作需要验证码 (OTP)。",
      );
    }
    const isOtpValid = await verifyMfa(approverId, otp);
    if (!isOtpValid) {
      throw createError(
        400,
        "Mã xác thực (OTP) không hợp lệ hoặc đã hết hạn.",
        "验证码 (OTP) 无效或已过期。",
      );
    }
  }

  // ── Check this is the correct level to approve ──
  // (previous levels must all be APPROVED first)
  const allRecords = await approvalRepo.findByEntity(
    record.entity_type,
    record.entity_id,
  );

  const previousLevels = allRecords.filter((r) => r.level < record.level);
  const previousAllApproved = previousLevels.every(
    (r) => r.status === "APPROVED",
  );

  if (!previousAllApproved) {
    throw createError(
      400,
      "Các cấp phê duyệt trước chưa hoàn thành.",
      "之前的审批级别尚未完成。",
    );
  }

  // ── Mark as APPROVED ──
  const now = new Date();
  await approvalRepo.updateStatus(approvalId, {
    status: "APPROVED",
    approver_id: approverId,
    approved_at: now,
    comments: comments ?? null,
    action_time: now,
    sync_time: now,
  });

  // ── Audit trail (ISO 9001) ──
  await logAudit({
    entity_type: record.entity_type,
    entity_id: record.entity_id,
    warehouse_id: record.warehouse_id,
    action: AuditAction.APPROVE,
    user_id: approverId,
    old_value: { status: "PENDING", level: record.level },
    new_value: {
      status: "APPROVED",
      level: record.level,
      comments: comments ?? null,
    },
  });

  // ── Check if this level is fully completed ──
  const approvedAtLevel = await approvalRepo.countApprovedAtLevel(
    record.entity_type,
    record.entity_id,
    record.level,
  );

  // Get min_approvers from config
  const chain = await configRepo.getActiveApprovalChain(
    record.entity_type,
    record.warehouse_id,
  );
  const levelConfig = chain.find((l) => l.level === record.level);
  const minApprovers = levelConfig?.min_approvers ?? 1;
  const levelCompleted = approvedAtLevel >= minApprovers;

  // ── Check if ALL levels are done ──
  const allApproved = await approvalRepo.isFullyApproved(
    record.entity_type,
    record.entity_id,
  );

  // Update record in memory for return and notifications
  const updatedRecord: ApprovalRecord = {
    ...record,
    status: "APPROVED",
    approver_id: approverId,
    approved_at: now,
    comments: comments ?? null,
  };

  // ── Entity status callback: advance voucher when fully approved ──
  if (allApproved) {
    try {
      await advanceEntityOnApproval(
        record.entity_type,
        record.entity_id,
        approverId,
      );
      await notifyApprovalCompleted(updatedRecord, approverId);
    } catch (callbackError) {
      // ── ROLLBACK: revert approval record to PENDING ──
      // Entity callback failed (e.g. ATP insufficient), so we must not
      // leave the approval in APPROVED while the voucher stays PENDING_APPROVAL.
      console.error(
        `[approvalService] Entity callback failed for ${record.entity_type}/${record.entity_id}. Rolling back approval record.`,
        callbackError,
      );
      await approvalRepo.updateStatus(approvalId, {
        status: "PENDING",
        approver_id: "",
        approved_at: now,
        action_time: now,
        sync_time: now,
      });
      throw callbackError;
    }
  } else if (levelCompleted) {
    await notifyNextApprovalLevel(updatedRecord);
  }

  return { allApproved, levelCompleted, record: updatedRecord };
}

// ─────────────────────────────────────────────
// REJECT
// ─────────────────────────────────────────────

/**
 * Reject an approval record and cascade-reject all remaining PENDING records.
 *
 * SELF-APPROVAL BLOCK: Also enforced here (rejector !== creator).
 */
export async function rejectApproval(
  approvalId: string,
  rejectorId: string,
  reason: string,
  otp?: string | null,
  rejector?: ScopedUser,
): Promise<ApprovalRecord> {
  if (!reason || reason.trim().length === 0) {
    throw createError(
      400,
      "Lý do từ chối không được để trống.",
      "拒绝理由不能为空。",
    );
  }

  const record = await approvalRepo.findById(approvalId);

  if (!record) {
    throw createError(
      404,
      "Không tìm thấy bản ghi phê duyệt.",
      "未找到审批记录。",
    );
  }

  if (rejector && !canActOnApprovalRecord(rejector, record)) {
    throw createError(
      403,
      "Bạn không có đúng role trong phạm vi kho của bước duyệt này. Vui lòng kiểm tra lại phân quyền theo kho hoặc liên hệ quản trị viên để được gán role phù hợp.",
      "您没有此审批步骤仓库范围内的正确角色。请检查仓库权限或联系管理员分配合适角色。",
    );
  }

  // ── OTP VERIFICATION (If required by config) ──
  const config = await configRepo.findByEntityType(
    record.entity_type,
    record.warehouse_id,
  );
  if (config?.require_otp) {
    if (!otp) {
      throw createError(
        400,
        "Mã xác thực (OTP) là bắt buộc cho thao tác này.",
        "此操作需要验证码 (OTP)。",
      );
    }
    const isOtpValid = await verifyMfa(rejectorId, otp);
    if (!isOtpValid) {
      throw createError(
        400,
        "Mã xác thực (OTP) không hợp lệ hoặc đã hết hạn.",
        "验证码 (OTP) 无效或已过期。",
      );
    }
  }

  if (record.status !== "PENDING") {
    throw createError(
      400,
      "Bản ghi phê duyệt này đã được xử lý.",
      "该审批记录已处理。",
    );
  }

  // Self-Approval Block applies to rejection too
  if (rejectorId === record.creator_id) {
    throw createError(
      403,
      "Không được phép tự từ chối lệnh do chính mình tạo.",
      "不允许自行拒绝自己创建的单据。",
    );
  }

  // Mark this record as REJECTED
  const now = new Date();
  await approvalRepo.updateStatus(approvalId, {
    status: "REJECTED",
    approver_id: rejectorId,
    approved_at: now,
    rejected_reason: reason,
    action_time: now,
    sync_time: now,
  });

  // Cascade-reject all remaining PENDING records for this entity
  await approvalRepo.rejectAllPending(
    record.entity_type,
    record.entity_id,
    rejectorId,
    `Cascade rejection from level ${record.level}: ${reason}`,
  );

  // ── Entity status callback: advance voucher to REJECTED ──
  await advanceEntityOnRejection(
    record.entity_type,
    record.entity_id,
    rejectorId,
    reason,
  );

  // Audit trail
  await logAudit({
    entity_type: record.entity_type,
    entity_id: record.entity_id,
    warehouse_id: record.warehouse_id,
    action: AuditAction.REJECT,
    user_id: rejectorId,
    old_value: { status: "PENDING", level: record.level },
    new_value: {
      status: "REJECTED",
      level: record.level,
      reason,
    },
  });

  return {
    ...record,
    status: "REJECTED",
    approver_id: rejectorId,
    approved_at: now,
    rejected_reason: reason,
  };
}

// ─────────────────────────────────────────────
// QUERY HELPERS (for Tasks page)
// ─────────────────────────────────────────────

/**
 * Get pending approval tasks for a user based on their role IDs.
 * Replaces the old useWorkflowTasks collectionGroup query.
 */
export async function getPendingTasksForUser(
  user: ScopedUser,
): Promise<ApprovalRecord[]> {
  const records = await approvalRepo.findPendingByRoleIds(user.roleIds || []);
  return records.filter((record) => canActOnApprovalRecord(user, record));
}

/**
 * Get approval timeline for a specific entity.
 * Used in voucher detail views.
 */
export async function getApprovalTimeline(
  entityType: ProcessEntityType,
  entityId: string,
): Promise<ApprovalRecord[]> {
  return approvalRepo.findByEntity(entityType, entityId);
}

// ─────────────────────────────────────────────
// ENTITY STATUS CALLBACKS
// ─────────────────────────────────────────────

/**
 * Advance the source entity when all approval levels are completed.
 * Uses dynamic import to avoid circular dependency.
 */
async function advanceEntityOnApproval(
  entityType: ProcessEntityType,
  entityId: string,
  approverId: string,
): Promise<void> {
  // NOTE: Do NOT catch errors here — caller (approveLevel) handles rollback.
  switch (entityType) {
    case "IMPORT_VOUCHER": {
      const { onApprovalCompleted } = await import("./importVoucherService.js");
      await onApprovalCompleted(entityId, approverId);
      console.log(
        `[approvalService] Advanced IMPORT_VOUCHER/${entityId} → APPROVED`,
      );
      break;
    }
    case "EXPORT_VOUCHER": {
      const { onApprovalCompleted: onExportApproved } =
        await import("./exportVoucherService.js");
      await onExportApproved(entityId, approverId);
      console.log(
        `[approvalService] Advanced EXPORT_VOUCHER/${entityId} → APPROVED`,
      );
      break;
    }
    case "TRANSFER_ORDER": {
      const { onApprovalCompleted: onTransferApproved } =
        await import("./transferOrderService.js");
      await onTransferApproved(entityId, approverId);
      console.log(
        `[approvalService] Advanced TRANSFER_ORDER/${entityId} → APPROVED`,
      );
      break;
    }
    // Future: PURCHASE_ORDER, etc.
    default:
      console.warn(
        `[approvalService] No callback for entity type: ${entityType}`,
      );
  }
}

/**
 * Advance the source entity when an approval is rejected.
 * Uses dynamic import to avoid circular dependency.
 */
async function advanceEntityOnRejection(
  entityType: ProcessEntityType,
  entityId: string,
  rejectorId: string,
  reason: string,
): Promise<void> {
  try {
    switch (entityType) {
      case "IMPORT_VOUCHER": {
        const { onApprovalRejected } =
          await import("./importVoucherService.js");
        await onApprovalRejected(entityId, rejectorId, reason);
        console.log(
          `[approvalService] Advanced IMPORT_VOUCHER/${entityId} → REJECTED`,
        );
        break;
      }
      case "EXPORT_VOUCHER": {
        const { onApprovalRejected: onExportRejected } =
          await import("./exportVoucherService.js");
        await onExportRejected(entityId, rejectorId, reason);
        console.log(
          `[approvalService] Advanced EXPORT_VOUCHER/${entityId} → REJECTED`,
        );
        break;
      }
      case "TRANSFER_ORDER": {
        const { onApprovalRejected: onTransferRejected } =
          await import("./transferOrderService.js");
        await onTransferRejected(entityId, rejectorId, reason);
        console.log(
          `[approvalService] Advanced TRANSFER_ORDER/${entityId} → REJECTED`,
        );
        break;
      }
      default:
        console.warn(
          `[approvalService] No reject callback for entity type: ${entityType}`,
        );
    }
  } catch (error) {
    console.error(
      `[approvalService] Failed to reject entity ${entityType}/${entityId}:`,
      error,
    );
  }
}

// ─────────────────────────────────────────────
// CANCEL BY CREATOR
// ─────────────────────────────────────────────

/**
 * Allows the CREATOR of a voucher/entity to cancel all pending approvals.
 *
 * RULES:
 * 1. Only the creator (creator_id) can cancel.
 * 2. Only PENDING records can be cancelled — if any record is already
 *    APPROVED, cancellation is blocked (the process has advanced).
 * 3. All PENDING records are batch-updated to CANCELLED.
 * 4. Entity-specific callback reverts voucher to CANCELLED.
 * 5. Full audit trail recorded.
 */
export async function cancelByCreator(
  entityType: ProcessEntityType,
  entityId: string,
  creatorId: string,
  reason?: string | null,
  otp?: string | null,
): Promise<void> {
  const allRecords = await approvalRepo.findByEntity(entityType, entityId);

  if (allRecords.length === 0) {
    throw createError(
      404,
      "Không tìm thấy bản ghi phê duyệt cho lệnh này.",
      "未找到该单据的审批记录。",
    );
  }

  // ── Verify caller is the creator ──
  const firstRecord = allRecords[0];
  if (firstRecord.creator_id !== creatorId) {
    throw createError(
      403,
      "Chỉ người tạo lệnh mới có quyền hủy.",
      "只有创建人才能撤销单据。",
    );
  }

  // ── OTP VERIFICATION (If required by config) ──
  const cancelConfig = await configRepo.findByEntityType(
    entityType,
    firstRecord.warehouse_id,
  );
  if (cancelConfig?.require_otp) {
    if (!otp) {
      throw createError(
        400,
        "Mã xác thực (OTP) là bắt buộc cho thao tác này.",
        "此操作需要验证码 (OTP)。",
      );
    }
    const isOtpValid = await verifyMfa(creatorId, otp);
    if (!isOtpValid) {
      throw createError(
        400,
        "Mã xác thực (OTP) không hợp lệ hoặc đã hết hạn.",
        "验证码 (OTP) 无效或已过期。",
      );
    }
  }

  // ── Check no records have been APPROVED already ──
  const hasApproved = allRecords.some((r) => r.status === "APPROVED");
  if (hasApproved) {
    throw createError(
      400,
      "Không thể hủy — lệnh đã được phê duyệt ở một hoặc nhiều cấp.",
      "无法撤销 — 单据已在一个或多个级别获批。",
    );
  }

  // ── Batch cancel all PENDING records ──
  const pendingRecords = allRecords.filter((r) => r.status === "PENDING");
  if (pendingRecords.length === 0) {
    throw createError(
      400,
      "Không có bản ghi chờ duyệt nào để hủy.",
      "没有待审批记录可撤销。",
    );
  }

  const now = new Date();
  const batch = db.batch();

  for (const record of pendingRecords) {
    batch.update(db.collection("pending_approvals").doc(record.id), {
      status: "CANCELLED",
      approver_id: creatorId,
      approved_at: now,
      rejected_reason: reason || "Người tạo tự hủy lệnh",
      sync_time: now,
    });
  }

  await batch.commit();

  // ── Entity callback: revert voucher → CANCELLED ──
  await cancelEntityOnCancel(entityType, entityId, creatorId, reason);

  // ── Audit trail (ISO 9001) ──
  await logAudit({
    entity_type: entityType,
    entity_id: entityId,
    warehouse_id: firstRecord.warehouse_id,
    action: AuditAction.CANCEL,
    user_id: creatorId,
    old_value: {
      status: "PENDING",
      pending_count: pendingRecords.length,
    },
    new_value: {
      status: "CANCELLED",
      reason: reason || "Người tạo tự hủy lệnh",
      cancelled_records: pendingRecords.map((r) => r.id),
    },
  });

  console.log(
    `[approvalService] Creator ${creatorId} cancelled ${pendingRecords.length} approval(s) for ${entityType}/${entityId}`,
  );
}

/**
 * Revert the source entity status to CANCELLED.
 * Uses dynamic import to avoid circular dependency.
 */
async function cancelEntityOnCancel(
  entityType: ProcessEntityType,
  entityId: string,
  userId: string,
  reason?: string | null,
): Promise<void> {
  try {
    switch (entityType) {
      case "IMPORT_VOUCHER": {
        const { onApprovalCancelled } =
          await import("./importVoucherService.js");
        await onApprovalCancelled(entityId, userId, reason);
        console.log(`[approvalService] Cancelled IMPORT_VOUCHER/${entityId}`);
        break;
      }
      case "EXPORT_VOUCHER": {
        const { onApprovalCancelled: onExportCancelled } =
          await import("./exportVoucherService.js");
        await onExportCancelled(entityId, userId, reason);
        console.log(`[approvalService] Cancelled EXPORT_VOUCHER/${entityId}`);
        break;
      }
      case "TRANSFER_ORDER":
      case "TRANSFER_INTRA": {
        const { onApprovalCancelled: onTransferCancelled } =
          await import("./transferOrderService.js");
        await onTransferCancelled(entityId, userId, reason);
        console.log(`[approvalService] Cancelled ${entityType}/${entityId}`);
        break;
      }
      default:
        console.warn(
          `[approvalService] No cancel callback for entity type: ${entityType}`,
        );
    }
  } catch (error) {
    console.error(
      `[approvalService] Failed to cancel entity ${entityType}/${entityId}:`,
      error,
    );
    throw error;
  }
}

// ─────────────────────────────────────────────
// FORCE CANCEL (by privileged user)
// ─────────────────────────────────────────────

/**
 * Force-cancel a voucher/entity at ANY status by a privileged user.
 *
 * Unlike cancelByCreator:
 * - Does NOT require the caller to be the creator
 * - Does NOT block when records are already APPROVED
 * - Cancels ALL non-CANCELLED records (PENDING + APPROVED)
 * - Requires a mandatory reason (audit trail)
 *
 * Permission: vouchers.force_cancel (checked in controller)
 */
export async function forceCancel(
  entityType: ProcessEntityType,
  entityId: string,
  userId: string,
  reason: string,
): Promise<void> {
  if (!reason || reason.trim().length === 0) {
    throw createError(
      400,
      "Lý do hủy là bắt buộc khi sử dụng quyền hủy đặc biệt.",
      "使用强制撤销权限时，撤销原因为必填项。",
    );
  }

  const allRecords = await approvalRepo.findByEntity(entityType, entityId);

  // ── Batch cancel all non-cancelled records ──
  const activeRecords = allRecords.filter((r) => r.status !== "CANCELLED");
  if (activeRecords.length === 0) {
    throw createError(
      400,
      "Không có bản ghi nào để hủy. Lệnh có thể đã bị hủy trước đó.",
      "没有可撤销的记录。该单据可能已被撤销。",
    );
  }

  const now = new Date();
  const batch = db.batch();

  for (const record of activeRecords) {
    batch.update(db.collection("pending_approvals").doc(record.id), {
      status: "CANCELLED",
      approver_id: userId,
      approved_at: now,
      rejected_reason: `[FORCE_CANCEL] ${reason}`,
      sync_time: now,
    });
  }

  await batch.commit();

  // ── Entity callback: revert voucher → CANCELLED ──
  await cancelEntityOnCancel(entityType, entityId, userId, reason);

  // ── Audit trail (ISO 9001) ──
  const warehouseId = allRecords[0]?.warehouse_id || "";
  await logAudit({
    entity_type: entityType,
    entity_id: entityId,
    warehouse_id: warehouseId,
    action: AuditAction.CANCEL,
    user_id: userId,
    old_value: {
      status: activeRecords.map((r) => r.status),
      record_count: activeRecords.length,
    },
    new_value: {
      status: "CANCELLED",
      reason,
      force_cancel: true,
      cancelled_records: activeRecords.map((r) => r.id),
    },
  });

  console.log(
    `[approvalService] User ${userId} FORCE CANCELLED ${activeRecords.length} record(s) for ${entityType}/${entityId}. Reason: ${reason}`,
  );
}
