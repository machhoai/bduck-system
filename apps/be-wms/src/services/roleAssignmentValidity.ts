import type { UserWarehouseRole } from "@bduck/shared-types";

export type RoleAssignmentValidityInput = Omit<
  Pick<
    UserWarehouseRole,
    "id" | "user_id" | "warehouse_id" | "role_id" | "is_active" | "is_deleted"
  >,
  "valid_from" | "valid_until"
> & {
  valid_from: string | Date | null;
  valid_until: string | Date | null;
};

const HO_CHI_MINH_UTC_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateBoundary = "START" | "END";

export const formatRoleAssignmentDate = (value: Date): string =>
  new Date(value.getTime() + HO_CHI_MINH_UTC_OFFSET_MS)
    .toISOString()
    .slice(0, 10);

export const resolveRoleAssignmentScopeKey = (
  warehouseId: string | null | undefined,
): string | null => {
  if (warehouseId === null) return "global";
  return typeof warehouseId === "string" && warehouseId.trim().length > 0
    ? warehouseId
    : null;
};

/**
 * Role validity fields are calendar DATE values in Asia/Ho_Chi_Minh (UTC+7).
 * They must not be parsed with `new Date("YYYY-MM-DD")`, which treats them as
 * UTC and expires access seven hours too early.
 */
export const parseRoleAssignmentDate = (
  value: string,
  boundary: DateBoundary,
): Date | null => {
  const match = DATE_PATTERN.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const normalizedUtc = new Date(Date.UTC(year, month - 1, day));

  if (
    normalizedUtc.getUTCFullYear() !== year ||
    normalizedUtc.getUTCMonth() !== month - 1 ||
    normalizedUtc.getUTCDate() !== day
  ) {
    return null;
  }

  const dayStartUtc = normalizedUtc.getTime() - HO_CHI_MINH_UTC_OFFSET_MS;
  return new Date(
    boundary === "START" ? dayStartUtc : dayStartUtc + DAY_MS - 1,
  );
};

const parseRoleAssignmentBoundary = (
  value: string | Date,
  boundary: DateBoundary,
): Date | null => {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? new Date(value) : null;
  }
  if (DATE_PATTERN.test(value)) {
    return parseRoleAssignmentDate(value, boundary);
  }

  // Temporary rollout compatibility for legacy seed/assignment records that
  // stored an ISO timestamp despite the shared DATE contract. Preserve the
  // exact instant; Phase 7 removes this branch after audited normalization.
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
};

export const isRoleAssignmentActive = (
  assignment: RoleAssignmentValidityInput,
  now: Date,
): boolean => {
  const nowTime = now.getTime();
  if (!Number.isFinite(nowTime)) return false;
  if (assignment.is_active !== true || assignment.is_deleted === true) {
    return false;
  }
  if (resolveRoleAssignmentScopeKey(assignment.warehouse_id) === null) {
    return false;
  }

  if (!assignment.valid_from) return false;
  const validFrom = parseRoleAssignmentBoundary(assignment.valid_from, "START");
  if (!validFrom || nowTime < validFrom.getTime()) return false;

  if (assignment.valid_until !== null) {
    if (!assignment.valid_until) return false;
    const validUntil = parseRoleAssignmentBoundary(
      assignment.valid_until,
      "END",
    );
    if (!validUntil || nowTime > validUntil.getTime()) return false;
  }

  return true;
};
