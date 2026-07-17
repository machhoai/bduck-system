import {
  FACILITY_ACCESS_POLICY_VERSION,
  type OfficeScopeConfig,
  type OfficeScopeMode,
} from "@bduck/shared-types";
import {
  authorizationError,
  type AuthorizationService,
} from "./authorization/index.js";

export const assertCanAdministerOfficeScope = (
  authorization: AuthorizationService,
  officeId: string,
): void => {
  if (authorization.context.isSystemAdmin) return;
  if (
    authorization.context.workplaceFacilityId !== officeId ||
    !authorization.can("office_scopes.write", officeId)
  ) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
};

/** Expanding the stable ceiling is deliberately reserved for system admins. */
export const assertCanExpandOfficeScopeCeiling = (
  authorization: AuthorizationService,
): void => {
  if (!authorization.context.isSystemAdmin) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
};

export const assertOfficeScopeWithinCeiling = ({
  authorization,
  officeId,
  nextMode,
  nextFacilityIds,
  ceilingMode,
  ceilingFacilityIds,
}: {
  authorization: AuthorizationService;
  officeId: string;
  nextMode: OfficeScopeMode;
  nextFacilityIds: readonly string[];
  ceilingMode: OfficeScopeMode | null;
  ceilingFacilityIds: readonly string[];
}): void => {
  assertCanAdministerOfficeScope(authorization, officeId);
  if (authorization.context.isSystemAdmin) return;
  if (nextMode === "ALL" && ceilingMode !== "ALL") {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
  if (ceilingMode === "ALL") return;
  const allowed = new Set(ceilingFacilityIds);
  if (nextFacilityIds.some((facilityId) => !allowed.has(facilityId))) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
};

export class OfficeScopeRevisionConflictError extends Error {
  readonly statusCode = 409;
  readonly code = "OFFICE_SCOPE_REVISION_CONFLICT";
  readonly messages = {
    vi: "Phạm vi văn phòng đã được thay đổi bởi phiên làm việc khác. Vui lòng tải dữ liệu mới trước khi lưu lại.",
    zh: "办公室范围已被其他会话修改，请加载最新数据后再保存。",
  };

  constructor() {
    super("OFFICE_SCOPE_REVISION_CONFLICT");
    this.name = "OfficeScopeRevisionConflictError";
  }
}

export const assertExpectedOfficeScopeRevision = (
  expectedRevision: number,
  persistedRevision: unknown,
): void => {
  if (
    !Number.isInteger(expectedRevision) ||
    expectedRevision < 0 ||
    !Number.isInteger(persistedRevision) ||
    (persistedRevision as number) < 0 ||
    expectedRevision !== persistedRevision
  ) {
    throw new OfficeScopeRevisionConflictError();
  }
};

export const createInitialOfficeScopeConfig = ({
  officeId,
  actorId,
  actionTime,
  syncTime,
}: {
  officeId: string;
  actorId: string;
  actionTime: Date;
  syncTime: Date;
}): OfficeScopeConfig => ({
  id: officeId,
  office_id: officeId,
  scope_mode: "SELECTED",
  is_active: true,
  policy_version: FACILITY_ACCESS_POLICY_VERSION,
  revision: 1,
  valid_from: null,
  valid_until: null,
  created_by: actorId,
  updated_by: actorId,
  is_deleted: false,
  created_at: syncTime,
  updated_at: syncTime,
  action_time: actionTime,
  sync_time: syncTime,
});
