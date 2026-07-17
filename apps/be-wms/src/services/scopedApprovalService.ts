import type { ApprovalRecord, ProcessEntityType } from "@bduck/shared-types";
import * as approvalRepo from "../repositories/approvalRepository.js";
import type { AuthenticatedRequestUser } from "../api/middlewares/requestAccessContext.js";
import {
  authorizationError,
  type AuthorizationService,
} from "./authorization/index.js";
import * as approvalService from "./approvalService.js";

const approvalFacilityId = (record: ApprovalRecord): string | null =>
  record.approval_warehouse_id === undefined
    ? record.warehouse_id
    : record.approval_warehouse_id;

const scopedUser = (user: AuthenticatedRequestUser) => ({
  id: user.id,
  roleIds: user.roleIds,
  roleAssignments: user.roleAssignments,
});

const assertApprovalAccess = (
  record: ApprovalRecord,
  authorization: AuthorizationService,
  requireRole: boolean,
): void => {
  const facilityId = approvalFacilityId(record);
  if (facilityId === null) {
    if (!authorization.context.isSystemAdmin) {
      throw authorizationError("AUTHORIZATION_DENIED");
    }
    return;
  }
  authorization.assertFacilityAccess(facilityId);
  if (
    requireRole &&
    !authorization.hasRoleAtFacility(record.role_id, facilityId)
  ) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
};

const loadApproval = async (approvalId: string): Promise<ApprovalRecord> => {
  const record = await approvalRepo.findById(approvalId);
  if (!record) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Không tìm thấy bản ghi phê duyệt.",
        zh: "未找到审批记录。",
      },
    };
  }
  return record;
};

export const getPendingTasksForUser = async (
  user: AuthenticatedRequestUser,
  authorization: AuthorizationService,
): Promise<ApprovalRecord[]> => {
  const records = authorization.context.isSystemAdmin
    ? await approvalRepo.findPendingByRoleIds(user.roleIds)
    : await approvalRepo.findPendingByRolesAndFacilities(
        user.roleIds,
        Object.keys(authorization.context.grants),
      );
  const accessible = records.filter((record) => {
    try {
      assertApprovalAccess(record, authorization, true);
      return true;
    } catch {
      return false;
    }
  });
  const byEntity = new Map<string, ApprovalRecord[]>();
  accessible.forEach((record) => {
    const key = `${record.entity_type}:${record.entity_id}`;
    byEntity.set(key, [...(byEntity.get(key) ?? []), record]);
  });

  const visible: ApprovalRecord[] = [];
  for (const recordsForEntity of byEntity.values()) {
    const allRecords = await approvalRepo.findByEntity(
      recordsForEntity[0].entity_type,
      recordsForEntity[0].entity_id,
    );
    const latestAttempt = Math.max(
      ...allRecords.map((record) => record.approval_attempt ?? 1),
    );
    const pendingLevels = allRecords
      .filter(
        (record) =>
          record.status === "PENDING" &&
          (record.approval_attempt ?? 1) === latestAttempt,
      )
      .map((record) => record.level);
    const currentLevel = Math.min(...pendingLevels);
    visible.push(
      ...recordsForEntity.filter((record) => record.level === currentLevel),
    );
  }
  return visible;
};

export const getApprovalTimeline = async (
  entityType: ProcessEntityType,
  entityId: string,
  authorization: AuthorizationService,
): Promise<ApprovalRecord[]> => {
  const records = await approvalRepo.findByEntity(entityType, entityId);
  if (records.length === 0) return [];
  assertApprovalAccess(records[0], authorization, false);
  return records;
};

export const approveLevel = async (
  approvalId: string,
  user: AuthenticatedRequestUser,
  comments: string | null | undefined,
  otp: string | null | undefined,
  authorization: AuthorizationService,
) => {
  const record = await loadApproval(approvalId);
  assertApprovalAccess(record, authorization, true);
  return approvalService.approveLevel(
    approvalId,
    user.id,
    comments,
    otp,
    scopedUser(user),
  );
};

export const rejectApproval = async (
  approvalId: string,
  user: AuthenticatedRequestUser,
  reason: string,
  otp: string | null | undefined,
  authorization: AuthorizationService,
): Promise<void> => {
  const record = await loadApproval(approvalId);
  assertApprovalAccess(record, authorization, true);
  await approvalService.rejectApproval(
    approvalId,
    user.id,
    reason,
    otp,
    scopedUser(user),
  );
};

export const cancelByCreator = async (
  entityType: ProcessEntityType,
  entityId: string,
  user: AuthenticatedRequestUser,
  reason: string | undefined,
  otp: string | undefined,
  authorization: AuthorizationService,
): Promise<void> => {
  const records = await approvalRepo.findByEntity(entityType, entityId);
  if (records.length > 0)
    assertApprovalAccess(records[0], authorization, false);
  await approvalService.cancelByCreator(
    entityType,
    entityId,
    user.id,
    reason,
    otp,
  );
};

export const forceCancel = async (
  entityType: ProcessEntityType,
  entityId: string,
  userId: string,
  reason: string,
  authorization: AuthorizationService,
): Promise<void> => {
  const records = await approvalRepo.findByEntity(entityType, entityId);
  if (records.length === 0) throw authorizationError("AUTHORIZATION_DENIED");
  const facilityId = records[0].warehouse_id;
  authorization.assert("vouchers.force_cancel", facilityId);
  await approvalService.forceCancel(entityType, entityId, userId, reason);
};
