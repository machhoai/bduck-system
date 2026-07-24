import {
  AuditAction,
  LeaveApprovalTaskStatus,
} from "@bduck/shared-types";
import type { LeaveApprovalActionResult } from "../repositories/leaveApprovalActionRepository.js";
import type {
  LeaveApprovalAvailabilityResult,
  LeaveApprovalReassignResult,
} from "../repositories/leaveApprovalAvailabilityRepository.js";
import { logAudit } from "./auditService.js";

export const auditLeaveApproverUnavailable = async (
  result: LeaveApprovalAvailabilityResult | null,
  actorId: string,
) => {
  if (!result) return;
  await Promise.all([
    logAudit({
      entity_type: "leave_approval_tasks",
      entity_id: result.task.id,
      warehouse_id: result.task.workplace_warehouse_id,
      action: AuditAction.UPDATE,
      user_id: actorId,
      old_value: result.previous_task as unknown as Record<string, unknown>,
      new_value: result.task as unknown as Record<string, unknown>,
      action_time: result.task.action_time,
    }),
    logAudit({
      entity_type: "leave_requests",
      entity_id: result.request.id,
      warehouse_id: result.request.workplace_warehouse_id,
      action: AuditAction.UPDATE,
      user_id: actorId,
      old_value: result.previous_request as unknown as Record<string, unknown>,
      new_value: result.request as unknown as Record<string, unknown>,
      action_time: result.request.action_time,
    }),
  ]);
};

export const auditLeaveApprovalDecision = async (
  result: LeaveApprovalActionResult,
  actorId: string,
  decision: "APPROVE" | "REJECT",
  actionTime: Date,
) =>
  Promise.all([
    logAudit({
      entity_type: "leave_requests",
      entity_id: result.request.id,
      warehouse_id: result.request.workplace_warehouse_id,
      action:
        decision === "APPROVE" ? AuditAction.APPROVE : AuditAction.REJECT,
      user_id: actorId,
      old_value: result.previous_request as unknown as Record<string, unknown>,
      new_value: result.request as unknown as Record<string, unknown>,
      action_time: actionTime,
    }),
    ...result.tasks
      .filter((current) => {
        const previous = result.previous_tasks.find(
          (item) => item.id === current.id,
        );
        return previous?.status !== current.status;
      })
      .map((current) =>
        logAudit({
          entity_type: "leave_approval_tasks",
          entity_id: current.id,
          warehouse_id: current.workplace_warehouse_id,
          action:
            current.status === LeaveApprovalTaskStatus.APPROVED
              ? AuditAction.APPROVE
              : current.status === LeaveApprovalTaskStatus.REJECTED
                ? AuditAction.REJECT
                : AuditAction.UPDATE,
          user_id: actorId,
          old_value: result.previous_tasks.find(
            (item) => item.id === current.id,
          ) as unknown as Record<string, unknown>,
          new_value: current as unknown as Record<string, unknown>,
          action_time: actionTime,
        }),
      ),
    ...result.ledger_entries.map((entry) =>
      logAudit({
        entity_type: "leave_ledger_entries",
        entity_id: entry.id,
        warehouse_id: entry.workplace_warehouse_id,
        action: AuditAction.CREATE,
        user_id: actorId,
        old_value: null,
        new_value: entry as unknown as Record<string, unknown>,
        action_time: actionTime,
      }),
    ),
    ...result.buckets.map((bucket) =>
      logAudit({
        entity_type: "leave_balance_buckets",
        entity_id: bucket.id,
        warehouse_id: bucket.workplace_warehouse_id,
        action: AuditAction.UPDATE,
        user_id: actorId,
        old_value: result.previous_buckets.find(
          (previous) => previous.id === bucket.id,
        ) as unknown as Record<string, unknown>,
        new_value: bucket as unknown as Record<string, unknown>,
        action_time: actionTime,
      }),
    ),
  ]);

export const auditLeaveApprovalReassignment = (
  result: LeaveApprovalReassignResult,
  actorId: string,
  actionTime: Date,
) =>
  Promise.all([
    logAudit({
      entity_type: "leave_requests",
      entity_id: result.request.id,
      warehouse_id: result.request.workplace_warehouse_id,
      action: AuditAction.UPDATE,
      user_id: actorId,
      old_value: result.previous_request as unknown as Record<string, unknown>,
      new_value: result.request as unknown as Record<string, unknown>,
      action_time: actionTime,
    }),
    logAudit({
      entity_type: "leave_approval_tasks",
      entity_id: result.task.id,
      warehouse_id: result.task.workplace_warehouse_id,
      action: AuditAction.UPDATE,
      user_id: actorId,
      old_value: result.previous_task as unknown as Record<string, unknown>,
      new_value: result.task as unknown as Record<string, unknown>,
      action_time: actionTime,
    }),
    logAudit({
      entity_type: "leave_approval_reassignments",
      entity_id: result.reassignment.id,
      warehouse_id: result.task.workplace_warehouse_id,
      action: AuditAction.CREATE,
      user_id: actorId,
      old_value: null,
      new_value: result.reassignment as unknown as Record<string, unknown>,
      action_time: actionTime,
    }),
  ]);
