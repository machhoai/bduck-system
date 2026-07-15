import {
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
  type FacilityAccessGrantSource,
} from "@bduck/shared-types";
import { authorizationError } from "./authorizationError.js";
import type {
  AccessContext,
  AccessContextFacilityGrant,
  AccessContextSeed,
} from "./authorizationTypes.js";

const issuedAccessContexts = new WeakSet<object>();

const freezePermissions = (
  permissions: Readonly<Record<string, boolean>>,
): Readonly<Record<string, boolean>> => {
  if (
    !permissions ||
    typeof permissions !== "object" ||
    Array.isArray(permissions)
  ) {
    throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
  }
  return Object.freeze(
    Object.fromEntries(
      Object.entries(permissions).filter(
        ([permission, enabled]) =>
          permission.trim().length > 0 &&
          permission === permission.trim() &&
          enabled === true,
      ),
    ),
  );
};

const isValidId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value === value.trim();

const isValidSource = (source: FacilityAccessGrantSource): boolean => {
  if (
    !source ||
    !isValidId(source.role_id) ||
    !isValidId(source.assignment_id)
  ) {
    return false;
  }
  if (source.type === "OFFICE_INHERITED") {
    return isValidId(source.office_id);
  }
  if (
    source.type === "DIRECT" ||
    source.type === "LEGACY_DIRECT" ||
    source.type === "SYSTEM_GLOBAL"
  ) {
    return source.office_id === null;
  }
  return false;
};

const sourceKey = (source: FacilityAccessGrantSource): string =>
  JSON.stringify([
    source.type,
    source.role_id,
    source.assignment_id,
    source.office_id ?? "",
  ]);

const freezeSources = (
  sources: readonly FacilityAccessGrantSource[],
): readonly FacilityAccessGrantSource[] => {
  if (!Array.isArray(sources)) {
    throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
  }
  const unique = new Map<string, FacilityAccessGrantSource>();
  sources.forEach((source) => {
    if (!isValidSource(source)) {
      throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
    }
    unique.set(sourceKey(source), { ...source });
  });
  return Object.freeze(
    Array.from(unique.values(), (source) => Object.freeze(source)),
  );
};

export const createAccessContext = (seed: AccessContextSeed): AccessContext => {
  const systemAdminSources = freezeSources(seed.systemAdminSources ?? []);
  if (
    !isValidId(seed.actorId) ||
    seed.policyVersion !== FACILITY_ACCESS_POLICY_VERSION ||
    typeof seed.isSystemAdmin !== "boolean" ||
    !Array.isArray(seed.grants) ||
    (seed.workplaceFacilityId !== null &&
      !isValidId(seed.workplaceFacilityId)) ||
    !(seed.computedAt instanceof Date) ||
    !Number.isFinite(seed.computedAt.getTime()) ||
    (!seed.workplaceFacilityId && !seed.isSystemAdmin) ||
    (seed.isSystemAdmin && systemAdminSources.length === 0) ||
    (!seed.isSystemAdmin && systemAdminSources.length > 0) ||
    systemAdminSources.some(
      (source) =>
        source.type !== "SYSTEM_GLOBAL" ||
        !source.role_id ||
        !source.assignment_id ||
        source.office_id !== null,
    )
  ) {
    throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
  }

  const grants: Record<string, AccessContextFacilityGrant> = {};
  seed.grants.forEach((grant) => {
    if (
      !isValidId(grant.facilityId) ||
      grants[grant.facilityId] ||
      !Object.values(WarehouseType).includes(grant.facilityType)
    ) {
      throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
    }
    const frozenPermissions = freezePermissions(grant.permissions);
    const frozenSources = freezeSources(grant.sources);
    if (
      Object.keys(frozenPermissions).length === 0 ||
      frozenSources.length === 0 ||
      (seed.isSystemAdmin &&
        (frozenPermissions["*"] !== true ||
          !frozenSources.some(
            (source) =>
              source.type === "SYSTEM_GLOBAL" &&
              systemAdminSources.some(
                (adminSource) => sourceKey(adminSource) === sourceKey(source),
              ),
          ))) ||
      (!seed.isSystemAdmin &&
        frozenSources.some((source) => source.type === "SYSTEM_GLOBAL"))
    ) {
      throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
    }
    grants[grant.facilityId] = Object.freeze({
      facilityId: grant.facilityId,
      facilityType: grant.facilityType,
      permissions: frozenPermissions,
      sources: frozenSources,
    });
  });

  const context = Object.freeze({
    actorId: seed.actorId,
    workplaceFacilityId: seed.workplaceFacilityId,
    isSystemAdmin: seed.isSystemAdmin,
    systemAdminSources,
    policyVersion: seed.policyVersion,
    computedAt: seed.computedAt.toISOString(),
    grants: Object.freeze(grants),
  }) as AccessContext;
  issuedAccessContexts.add(context);
  return context;
};

export const isAccessContext = (value: unknown): value is AccessContext =>
  typeof value === "object" &&
  value !== null &&
  issuedAccessContexts.has(value);
