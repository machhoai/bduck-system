import type { Request } from "express";
import {
  UserStatus,
  type FacilityAccessGrantSource,
  type User,
} from "@bduck/shared-types";
import {
  AuthorizationService,
  authorizationError,
  isAccessContext,
  type AccessContext,
  type AuthorizationAssignment,
  type AuthorizationSourceSnapshot,
} from "../../services/authorization/index.js";

export type LegacyScopedPermissions = Record<string, Record<string, boolean>>;

export type RequestUserIdentity = Pick<
  User,
  | "id"
  | "username"
  | "email"
  | "full_name"
  | "employee_id"
  | "status"
  | "is_deleted"
  | "created_at"
  | "updated_at"
  | "workplace_facility_id"
  | "mfa_enabled"
>;

export interface AuthenticatedRequestUser extends RequestUserIdentity {
  uid: string;
  permissions: LegacyScopedPermissions;
  roleAssignments: AuthorizationAssignment[];
  roleIds: string[];
  roleNames: string[];
}

declare module "express" {
  interface Request {
    accessContext?: AccessContext;
    user?: AuthenticatedRequestUser;
  }
}

export type AccessContextRequest = Request & {
  accessContext: AccessContext;
};

const sourceKey = (source: FacilityAccessGrantSource): string =>
  JSON.stringify([
    source.type,
    source.role_id,
    source.assignment_id,
    source.office_id,
  ]);

const collectContextSources = (
  context: AccessContext,
): FacilityAccessGrantSource[] => {
  const sources = new Map<string, FacilityAccessGrantSource>();
  const addSource = (source: FacilityAccessGrantSource) =>
    sources.set(sourceKey(source), source);
  context.systemAdminSources.forEach(addSource);
  Object.values(context.grants).forEach((grant) =>
    grant.sources.forEach(addSource),
  );
  return Array.from(sources.values());
};

const deriveLegacyPermissions = (
  context: AccessContext,
): LegacyScopedPermissions => {
  const permissions: LegacyScopedPermissions = {};
  Object.values(context.grants).forEach((grant) => {
    permissions[grant.facilityId] = { ...grant.permissions };
  });
  if (context.isSystemAdmin) permissions.global = { "*": true };
  return permissions;
};

export const createAuthenticatedRequestUser = (
  snapshot: AuthorizationSourceSnapshot,
  context: AccessContext,
  requestUser: User | null,
): AuthenticatedRequestUser => {
  const actor = snapshot.actor;
  if (
    !isAccessContext(context) ||
    !actor ||
    !requestUser ||
    actor.id !== context.actorId ||
    requestUser.id !== actor.id ||
    requestUser.status !== UserStatus.ACTIVE ||
    requestUser.is_deleted !== false ||
    (!context.isSystemAdmin &&
      requestUser.workplace_facility_id !== actor.workplace_facility_id)
  ) {
    throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
  }

  const sources = collectContextSources(context);
  const assignmentIds = new Set(sources.map((source) => source.assignment_id));
  const roleIds = Array.from(
    new Set(sources.map((source) => source.role_id)),
  ).sort();
  const roleIdSet = new Set(roleIds);
  const roleNames = Array.from(
    new Set(
      snapshot.roles
        .filter((role) => roleIdSet.has(role.id))
        .map((role) => role.name),
    ),
  ).sort();

  return {
    id: requestUser.id,
    uid: requestUser.id,
    username: requestUser.username,
    email: requestUser.email,
    full_name: requestUser.full_name,
    employee_id: requestUser.employee_id,
    status: requestUser.status,
    is_deleted: requestUser.is_deleted,
    created_at: requestUser.created_at,
    updated_at: requestUser.updated_at,
    workplace_facility_id: requestUser.workplace_facility_id,
    mfa_enabled: requestUser.mfa_enabled,
    permissions: deriveLegacyPermissions(context),
    roleAssignments: snapshot.assignments
      .filter((assignment) => assignmentIds.has(assignment.id))
      .sort((left, right) => left.id.localeCompare(right.id)),
    roleIds,
    roleNames,
  };
};

export const attachRequestAccess = (
  req: Request,
  context: AccessContext,
  user?: AuthenticatedRequestUser,
): void => {
  if (
    !isAccessContext(context) ||
    (user !== undefined && user.id !== context.actorId)
  ) {
    throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
  }
  req.accessContext = context;
  if (user) req.user = user;
};

export const getRequestAccessContext = (req: Request): AccessContext | null =>
  isAccessContext(req.accessContext) ? req.accessContext : null;

export const getRequestAuthorization = (
  req: Request,
): AuthorizationService | null => {
  const context = getRequestAccessContext(req);
  return context ? new AuthorizationService(context) : null;
};

export const requireRequestAuthorization = (
  req: Request,
): AuthorizationService => {
  const authorization = getRequestAuthorization(req);
  if (!authorization) throw authorizationError("AUTHORIZATION_ACTOR_REQUIRED");
  return authorization;
};

export const requireAuthenticatedRequestUser = (
  req: Request,
): AuthenticatedRequestUser => {
  if (!req.user) throw authorizationError("AUTHORIZATION_ACTOR_REQUIRED");
  return req.user;
};
