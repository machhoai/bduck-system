import type {
  ApprovalLevel,
  ApprovalScopeMode,
  ProcessEntityType,
  StepOption,
  UserWarehouseRole,
} from "@bduck/shared-types";

import { isRoleAssignmentActive } from "./roleAssignmentValidity.js";

const TRANSFER_ENTITY_TYPES = new Set<ProcessEntityType>([
  "TRANSFER_ORDER",
  "TRANSFER_INTRA",
]);

const BASE_SCOPES: ApprovalScopeMode[] = ["ENTITY_WAREHOUSE", "GLOBAL"];
const TRANSFER_SCOPES: ApprovalScopeMode[] = [
  "ENTITY_WAREHOUSE",
  "SOURCE_WAREHOUSE",
  "DESTINATION_WAREHOUSE",
  "GLOBAL",
];

const scopeError = (vi: string, zh: string) => ({
  statusCode: 400,
  messages: { vi, zh },
});

export function getAllowedProcessScopes(
  entityType: ProcessEntityType,
): readonly ApprovalScopeMode[] {
  return TRANSFER_ENTITY_TYPES.has(entityType)
    ? TRANSFER_SCOPES
    : BASE_SCOPES;
}

export function assertProcessConfigScopesAllowed(
  entityType: ProcessEntityType,
  approvalChain: readonly ApprovalLevel[],
  stepOptions: Readonly<Record<string, StepOption>>,
): void {
  const allowed = new Set(getAllowedProcessScopes(entityType));
  const invalidApproval = approvalChain.find(
    (level) => !allowed.has(level.approval_scope ?? "ENTITY_WAREHOUSE"),
  );
  if (invalidApproval) {
    throw scopeError(
      "Chỉ quy trình điều chuyển mới được chọn phạm vi kho nguồn hoặc kho đích.",
      "只有调拨流程可以选择来源仓库或目标仓库范围。",
    );
  }

  const invalidStep = Object.values(stepOptions).find(
    (option) =>
      !allowed.has(option.assignment_scope ?? "ENTITY_WAREHOUSE"),
  );
  if (invalidStep) {
    throw scopeError(
      "Chỉ bước xử lý của quy trình điều chuyển mới được chọn kho nguồn hoặc kho đích.",
      "只有调拨流程的处理步骤可以选择来源仓库或目标仓库。",
    );
  }
}

export function collectGlobalRoleIds(input: {
  approvalChain: readonly ApprovalLevel[];
  stepOptions: Readonly<Record<string, StepOption>>;
}): string[] {
  const roleIds = new Set<string>();
  input.approvalChain.forEach((level) => {
    if (level.approval_scope === "GLOBAL" && level.role_id) {
      roleIds.add(level.role_id);
    }
  });

  Object.values(input.stepOptions).forEach((option) => {
    if (
      option.assignment_mode === "ROLE" &&
      option.assignment_scope === "GLOBAL" &&
      option.assigned_role_id
    ) {
      roleIds.add(option.assigned_role_id);
    }
  });
  return [...roleIds].sort();
}

export function findMissingActiveGlobalRoleIds(
  roleIds: readonly string[],
  assignments: readonly UserWarehouseRole[],
  activeUserIds: ReadonlySet<string>,
  now: Date,
): string[] {
  const validRoleIds = new Set(
    assignments.flatMap((assignment) =>
      assignment.warehouse_id === null &&
      activeUserIds.has(assignment.user_id) &&
      isRoleAssignmentActive(assignment, now)
        ? [assignment.role_id]
        : [],
    ),
  );
  return Array.from(new Set(roleIds))
    .filter((roleId) => !validRoleIds.has(roleId))
    .sort();
}
