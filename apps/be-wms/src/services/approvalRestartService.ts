import {
  AuditAction,
  type ApprovalRecord,
  type ProcessEntityType,
} from "@bduck/shared-types";

import * as approvalEntityRepository from "../repositories/approvalEntityRepository.js";
import * as approvalRepository from "../repositories/approvalRepository.js";

import { prepareApprovalsForEntity } from "./approvalPreparationService.js";
import {
  assertApprovalRestartable,
  getCurrentApprovalAttempt,
  type CurrentApprovalAttempt,
} from "./approvalRestartPolicy.js";
import { completePreparedApprovals } from "./approvalService.js";
import { logAudit } from "./auditService.js";

const restartError = (statusCode: number, vi: string, zh: string) => ({
  statusCode,
  messages: { vi, zh },
});

const approvalAuditSnapshot = (record: ApprovalRecord) => ({
  id: record.id,
  attempt: record.approval_attempt ?? 1,
  level: record.level,
  role_id: record.role_id,
  status: record.status,
  approval_scope: record.approval_scope ?? "ENTITY_WAREHOUSE",
  approval_warehouse_id:
    record.approval_warehouse_id === undefined
      ? record.warehouse_id
      : record.approval_warehouse_id,
  approver_id: record.approver_id,
  approved_at: record.approved_at,
  rejected_reason: record.rejected_reason,
  comments: record.comments,
  action_time: record.action_time,
});

export interface ApprovalRestartContext {
  entity: approvalEntityRepository.ApprovalEntitySnapshot;
  currentAttempt: CurrentApprovalAttempt;
}

export interface ApprovalRestartResult {
  attempt: number;
  records: ApprovalRecord[];
}

export async function loadApprovalRestartContext(
  entityType: ProcessEntityType,
  entityId: string,
): Promise<ApprovalRestartContext> {
  const [entity, records] = await Promise.all([
    approvalEntityRepository.findApprovalEntity(entityType, entityId),
    approvalRepository.findByEntity(entityType, entityId),
  ]);
  if (!entity) {
    throw restartError(
      404,
      "Không tìm thấy chứng từ để khởi tạo lại luồng duyệt.",
      "未找到需要重新初始化审批流程的单据。",
    );
  }

  const currentAttempt = getCurrentApprovalAttempt(records);
  assertApprovalRestartable(entityType, entity.status, currentAttempt);
  if (
    currentAttempt.records.some(
      (record) => record.creator_id !== entity.creatorId,
    )
  ) {
    throw restartError(
      409,
      "Thông tin người tạo giữa chứng từ và luồng duyệt không khớp.",
      "单据与审批流程中的创建人信息不一致。",
    );
  }

  return { entity, currentAttempt };
}

export async function restartApprovalFlow(
  entityType: ProcessEntityType,
  entityId: string,
  actorId: string,
  reason: string,
  actionTime: Date,
  context: ApprovalRestartContext,
): Promise<ApprovalRestartResult> {
  const firstCurrentRecord = context.currentAttempt.records[0];
  const configEntityType =
    firstCurrentRecord.config_entity_type ?? entityType;
  const plan = await prepareApprovalsForEntity({
    entityType,
    entityId,
    warehouseId: context.entity.warehouseId,
    creatorId: context.entity.creatorId,
    displayInfo: {
      voucher_number:
        context.entity.voucherNumber ?? firstCurrentRecord.voucher_number,
      creator_name:
        context.entity.creatorName ?? firstCurrentRecord.creator_name,
    },
    scopeInfo: {
      sourceWarehouseId: context.entity.sourceWarehouseId,
      destinationWarehouseId: context.entity.destinationWarehouseId,
    },
    options: { configEntityType },
  });
  if (plan.mode !== "RECORDS") {
    throw restartError(
      409,
      "Cấu hình mới nhất không có cấp duyệt đang hoạt động nên không thể tạo attempt mới.",
      "最新配置没有启用的审批层级，因此无法创建新的审批轮次。",
    );
  }

  try {
    await approvalRepository.restartAttempt({
      entityCollection: context.entity.collectionName,
      entityId,
      expectedEntityStatus: context.entity.status,
      expectedAttempt: context.currentAttempt.attempt,
      expectedRecords: context.currentAttempt.records,
      newRecords: plan.records,
      actorId,
      reason,
      actionTime,
    });
  } catch (error) {
    if (error instanceof approvalRepository.ApprovalRestartConflictError) {
      throw restartError(
        409,
        "Luồng duyệt vừa thay đổi. Vui lòng tải lại dữ liệu trước khi thử lại.",
        "审批流程刚刚发生变化，请刷新数据后重试。",
      );
    }
    throw error;
  }

  const newAttempt = plan.records[0].approval_attempt ?? 1;
  await logAudit({
    entity_type: entityType,
    entity_id: entityId,
    warehouse_id: context.entity.warehouseId,
    action: AuditAction.UPDATE,
    user_id: actorId,
    action_time: actionTime,
    old_value: {
      status: context.entity.status,
      approval_attempt: context.currentAttempt.attempt,
      approval_records: context.currentAttempt.records.map(
        approvalAuditSnapshot,
      ),
    },
    new_value: {
      status: "PENDING_APPROVAL",
      approval_attempt: newAttempt,
      config_entity_type: plan.configEntityType,
      config_id: plan.configId,
      reason,
      approval_records: plan.records.map(approvalAuditSnapshot),
    },
    notes: "Khởi tạo lại luồng duyệt",
  });
  await completePreparedApprovals(plan);

  return { attempt: newAttempt, records: plan.records };
}
