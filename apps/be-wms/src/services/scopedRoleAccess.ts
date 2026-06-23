import type {
  ApprovalRecord,
  ApprovalScopeMode,
  StepOption,
  UserWarehouseRole,
} from "@bduck/shared-types";

export interface ScopedUser {
  id: string;
  roleIds?: string[];
  roleAssignments?: UserWarehouseRole[];
}

interface RoleScopeOptions {
  allowGlobalFallback?: boolean;
  requireGlobal?: boolean;
  now?: Date;
}

export function activeRoleAssignments(
  assignments: UserWarehouseRole[] | undefined,
  now = new Date(),
): UserWarehouseRole[] {
  return (assignments || []).filter((assignment) => {
    if (!assignment.is_active) return false;

    const from = assignment.valid_from ? new Date(assignment.valid_from) : null;
    if (from && from.getTime() > now.getTime()) return false;

    const until = assignment.valid_until
      ? new Date(assignment.valid_until)
      : null;
    if (until && until.getTime() < now.getTime()) return false;

    return true;
  });
}

export function uniqueRoleIds(assignments: UserWarehouseRole[]): string[] {
  return Array.from(new Set(assignments.map((item) => item.role_id)));
}

export function hasRoleInScope(
  assignments: UserWarehouseRole[] | undefined,
  roleId: string | null | undefined,
  warehouseId: string | null | undefined,
  options: RoleScopeOptions = {},
): boolean {
  if (!roleId) return false;

  const activeAssignments = activeRoleAssignments(assignments, options.now);
  return activeAssignments.some((assignment) => {
    if (assignment.role_id !== roleId) return false;

    const isAssignmentGlobal = assignment.warehouse_id == null || assignment.warehouse_id === "";

    if (options.requireGlobal) {
      return isAssignmentGlobal;
    }

    if (warehouseId != null && warehouseId !== "") {
      return (
        assignment.warehouse_id === warehouseId ||
        (options.allowGlobalFallback === true && isAssignmentGlobal)
      );
    }

    return isAssignmentGlobal;
  });
}

export function getApprovalWarehouseId(record: ApprovalRecord): string | null {
  if ("approval_warehouse_id" in record) {
    return record.approval_warehouse_id ?? null;
  }
  return record.warehouse_id || null;
}

export function canActOnApprovalRecord(
  user: ScopedUser,
  record: ApprovalRecord,
): boolean {
  const approvalWarehouseId = getApprovalWarehouseId(record);
  const requireGlobal = record.approval_scope === "GLOBAL";

  return hasRoleInScope(user.roleAssignments, record.role_id, approvalWarehouseId, {
    allowGlobalFallback: record.allow_global_fallback === true,
    requireGlobal,
  });
}

export function resolveStepWarehouseId(
  scope: ApprovalScopeMode | undefined,
  entityWarehouseId: string | null | undefined,
  sourceWarehouseId?: string | null,
  destinationWarehouseId?: string | null,
): string | null {
  switch (scope) {
    case "GLOBAL":
      return null;
    case "SOURCE_WAREHOUSE":
      return sourceWarehouseId || entityWarehouseId || null;
    case "DESTINATION_WAREHOUSE":
      return destinationWarehouseId || entityWarehouseId || null;
    case "ENTITY_WAREHOUSE":
    default:
      return entityWarehouseId || null;
  }
}

export function canPerformRoleStep(
  user: ScopedUser,
  stepOption: StepOption,
  entityWarehouseId: string | null | undefined,
  sourceWarehouseId?: string | null,
  destinationWarehouseId?: string | null,
): boolean {
  const scope = stepOption.assignment_scope ?? "ENTITY_WAREHOUSE";
  const stepWarehouseId = resolveStepWarehouseId(
    scope,
    entityWarehouseId,
    sourceWarehouseId,
    destinationWarehouseId,
  );

  return hasRoleInScope(user.roleAssignments, stepOption.assigned_role_id, stepWarehouseId, {
    allowGlobalFallback: stepOption.allow_global_fallback === true,
    requireGlobal: scope === "GLOBAL",
  });
}
