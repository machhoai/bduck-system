import type {
  EmployeeProfile,
  LeaveImportBatch,
  LeaveImportNormalizedPayload,
  LeaveImportRow,
  LeaveImportRowView,
} from "@bduck/shared-types";
import { LeaveImportRecordType } from "@bduck/shared-types";
import type { AuthorizationService } from "./authorization/index.js";

export const LEAVE_IMPORT_PERMISSION = "leave.history.import";

export const assertCanImportLeaveHistory = (
  authorization: AuthorizationService,
) => {
  if (
    !authorization.context.isSystemAdmin &&
    authorization.facilityIdsFor(LEAVE_IMPORT_PERMISSION).length === 0
  ) {
    throw { statusCode: 403 };
  }
};

export const canImportLeaveForProfile = (
  authorization: AuthorizationService,
  profile: EmployeeProfile,
): boolean =>
  authorization.context.isSystemAdmin ||
  authorization.can(
    LEAVE_IMPORT_PERMISSION,
    profile.workplace_warehouse_id,
  );

export const canImportLeaveRecord = (
  authorization: AuthorizationService,
  profile: EmployeeProfile,
  recordType: LeaveImportRecordType,
): boolean =>
  canImportLeaveForProfile(authorization, profile) &&
  (recordType !== LeaveImportRecordType.ADJUSTMENT ||
    authorization.context.isSystemAdmin ||
    authorization.can(
      "leave.balance.adjust",
      profile.workplace_warehouse_id,
    ));

export const assertLeaveImportBatchAccess = (
  batch: LeaveImportBatch,
  actorId: string,
  authorization: AuthorizationService,
) => {
  assertCanImportLeaveHistory(authorization);
  const canAccessEveryFacility =
    authorization.context.isSystemAdmin ||
    (batch.workplace_warehouse_ids.length > 0 &&
      batch.workplace_warehouse_ids.every((facilityId) =>
        authorization.can(LEAVE_IMPORT_PERMISSION, facilityId),
      ));
  const canAccessInvalidPreview =
    batch.workplace_warehouse_ids.length === 0 && batch.created_by === actorId;
  if (!canAccessEveryFacility && !canAccessInvalidPreview) {
    throw { statusCode: 403 };
  }
};

export const mapEmployeeProfilesByCode = (profiles: EmployeeProfile[]) =>
  new Map(
    profiles.map((profile) => [profile.employee_code.toUpperCase(), profile]),
  );

export const buildLeaveImportRowViews = (
  rows: LeaveImportRow[],
  profiles: Map<string, EmployeeProfile>,
): LeaveImportRowView[] =>
  rows.map((row) => {
    const profile = profiles.get(row.employee_code.toUpperCase());
    return {
      ...row,
      normalized_payload:
        row.normalized_payload as unknown as LeaveImportNormalizedPayload,
      employee_profile_id: profile?.id ?? null,
      employee_name: profile?.full_name ?? null,
    };
  });
