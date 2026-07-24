import {
  AuditAction,
  type LeaveApprovalConfig,
  type LeaveApprovalConfigOptions,
  type UpsertLeaveApprovalConfigInput,
} from "@bduck/shared-types";
import {
  findActiveLeaveApprovalUsers,
  findLeaveApprovalRoles,
  getCompanyLeaveApprovalConfig,
  saveCompanyLeaveApprovalConfig,
} from "../repositories/leaveApprovalConfigRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import { logAudit } from "./auditService.js";
import { userHasAnyLeaveApprovalScope } from "./leaveApproverEligibilityService.js";
import { normalizeLeaveApprovalLevels } from "./leaveApprovalPolicy.js";

const assertCanManage = (authorization: AuthorizationService) => {
  if (
    !authorization.context.isSystemAdmin &&
    authorization.facilityIdsFor("leave.config.manage").length === 0
  ) {
    throw { statusCode: 403 };
  }
};

const assertCanReadOptions = (authorization: AuthorizationService) => {
  if (
    !authorization.context.isSystemAdmin &&
    authorization.facilityIdsFor("leave.config.manage").length === 0 &&
    authorization.facilityIdsFor("leave.approver.reassign").length === 0
  ) {
    throw { statusCode: 403 };
  }
};

export const fetchLeaveApprovalConfig = async (
  authorization: AuthorizationService,
) => {
  assertCanManage(authorization);
  return getCompanyLeaveApprovalConfig();
};

export const fetchLeaveApprovalConfigOptions = async (
  authorization: AuthorizationService,
): Promise<LeaveApprovalConfigOptions> => {
  assertCanReadOptions(authorization);
  const [roles, users] = await Promise.all([
    findLeaveApprovalRoles(),
    findActiveLeaveApprovalUsers(),
  ]);
  const eligibleUsers = (
    await Promise.all(
      users.map(async (user) => ({
        user,
        eligible: await userHasAnyLeaveApprovalScope(user.id),
      })),
    )
  ).filter((item) => item.eligible);
  return {
    roles: roles.map(({ id, name, color }) => ({ id, name, color })),
    users: eligibleUsers.map(({ user }) => ({
      id: user.id,
      full_name: user.full_name,
      employee_id: user.employee_id,
    })),
  };
};

export const upsertLeaveApprovalConfig = async (
  input: UpsertLeaveApprovalConfigInput,
  actorId: string,
  authorization: AuthorizationService,
): Promise<LeaveApprovalConfig> => {
  assertCanManage(authorization);
  const levels = normalizeLeaveApprovalLevels(input.levels);
  const options = await fetchLeaveApprovalConfigOptions(authorization);
  const roleIds = new Set(options.roles.map((role) => role.id));
  const userIds = new Set(options.users.map((user) => user.id));
  const invalid = levels.find(
    (level) =>
      level.enabled &&
      (level.assignment.mode === "ROLE"
        ? !roleIds.has(level.assignment.role_id)
        : !userIds.has(level.assignment.assigned_user_id)),
  );
  if (invalid) {
    throw {
      statusCode: 400,
      messages: {
        vi: `Người/role duyệt ở cấp ${invalid.level} không còn hợp lệ hoặc chưa có quyền duyệt nghỉ phép.`,
        zh: `第 ${invalid.level} 级审批人或角色无效，或不具备休假审批权限。`,
      },
    };
  }
  const previous = await getCompanyLeaveApprovalConfig();
  const now = new Date();
  const config: LeaveApprovalConfig = {
    id: "company",
    scope: "COMPANY",
    levels,
    created_by: previous?.created_by ?? actorId,
    updated_by: actorId,
    is_deleted: false,
    created_at: previous?.created_at ?? now,
    updated_at: now,
    action_time: input.action_time,
    sync_time: now,
  };
  await saveCompanyLeaveApprovalConfig(config);
  await logAudit({
    entity_type: "leave_approval_configs",
    entity_id: config.id,
    action: previous ? AuditAction.UPDATE : AuditAction.CREATE,
    user_id: actorId,
    old_value: previous as unknown as Record<string, unknown> | null,
    new_value: config as unknown as Record<string, unknown>,
    action_time: input.action_time,
  });
  return config;
};
