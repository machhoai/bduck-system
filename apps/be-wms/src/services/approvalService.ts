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
import { AuditAction } from "@bduck/shared-types";
import type {
  ProcessEntityType,
  ApprovalRecord,
  ApprovalLevel,
} from "@bduck/shared-types";
import * as approvalRepo from "../repositories/approvalRepository.js";
import * as configRepo from "../repositories/processConfigRepository.js";
import { logAudit } from "./auditService.js";

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
    // Create min_approvers records per level (default 1)
    const count = Math.max(level.min_approvers || 1, 1);
    for (let i = 0; i < count; i++) {
      records.push({
        id: randomUUID(),
        entity_type: entityType,
        entity_id: entityId,
        warehouse_id: warehouseId,
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
      });
    }
  }

  await approvalRepo.createBatch(records);
  console.log(
    `[approvalService] Created ${records.length} pending_approval records for ${entityType}/${entityId}`,
  );
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

  // ── SELF-APPROVAL BLOCK (Defense in Depth) ──
  if (approverId === record.creator_id) {
    throw createError(
      403,
      "Không được phép tự phê duyệt lệnh do chính mình tạo (Segregation of Duties).",
      "不允许自行审批自己创建的单据（职责分离）。",
    );
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

  // ── Entity status callback: advance voucher when fully approved ──
  if (allApproved) {
    await advanceEntityOnApproval(
      record.entity_type,
      record.entity_id,
      approverId,
    );
  }

  // Update record in memory for return
  const updatedRecord: ApprovalRecord = {
    ...record,
    status: "APPROVED",
    approver_id: approverId,
    approved_at: now,
    comments: comments ?? null,
  };

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
export async function getPendingTasksForRoles(
  roleIds: string[],
): Promise<ApprovalRecord[]> {
  return approvalRepo.findPendingByRoleIds(roleIds);
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
  try {
    switch (entityType) {
      case "IMPORT_VOUCHER": {
        const { onApprovalCompleted } = await import(
          "./importVoucherService.js"
        );
        await onApprovalCompleted(entityId, approverId);
        console.log(
          `[approvalService] Advanced IMPORT_VOUCHER/${entityId} → APPROVED`,
        );
        break;
      }
      case "EXPORT_VOUCHER": {
        const { onApprovalCompleted: onExportApproved } = await import(
          "./exportVoucherService.js"
        );
        await onExportApproved(entityId, approverId);
        console.log(
          `[approvalService] Advanced EXPORT_VOUCHER/${entityId} → APPROVED`,
        );
        break;
      }
      // Future: TRANSFER_ORDER, etc.
      default:
        console.warn(
          `[approvalService] No callback for entity type: ${entityType}`,
        );
    }
  } catch (error) {
    console.error(
      `[approvalService] Failed to advance entity ${entityType}/${entityId}:`,
      error,
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
        const { onApprovalRejected } = await import(
          "./importVoucherService.js"
        );
        await onApprovalRejected(entityId, rejectorId, reason);
        console.log(
          `[approvalService] Advanced IMPORT_VOUCHER/${entityId} → REJECTED`,
        );
        break;
      }
      case "EXPORT_VOUCHER": {
        const { onApprovalRejected: onExportRejected } = await import(
          "./exportVoucherService.js"
        );
        await onExportRejected(entityId, rejectorId, reason);
        console.log(
          `[approvalService] Advanced EXPORT_VOUCHER/${entityId} → REJECTED`,
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

