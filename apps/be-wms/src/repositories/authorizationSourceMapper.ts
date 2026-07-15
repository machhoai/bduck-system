import {
  ActiveStatus,
  EmployeeProfileStatus,
  UserStatus,
  WarehouseType,
} from "@bduck/shared-types";
import type {
  AuthorizationActor,
  AuthorizationAssignment,
  AuthorizationDate,
  AuthorizationFacility,
  AuthorizationOfficeScopeConfig,
  AuthorizationOfficeScopeEdge,
  AuthorizationRole,
} from "../services/authorization/authorizationTypes.js";

export const AUTHORIZATION_DATE_TIME_ZONE = "Asia/Ho_Chi_Minh";
export interface AuthorizationSourceDocument {
  id: string;
  data: Readonly<Record<string, unknown>>;
}

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;
const hasOwn = (data: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(data, key);
export const isAuthorizationSourceId = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value === value.trim();

const invalidDate = (): Date => new Date(Number.NaN);

export const normalizeAuthorizationSourceDate = (
  value: unknown,
): AuthorizationDate | null => {
  if (value === null) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? new Date(value) : invalidDate();
  }
  if (value && typeof value === "object") {
    const timestamp = value as {
      toDate?: unknown;
      seconds?: unknown;
      nanoseconds?: unknown;
    };
    if (typeof timestamp.toDate === "function") {
      try {
        const date = (timestamp.toDate as () => Date)();
        return date instanceof Date && Number.isFinite(date.getTime())
          ? new Date(date)
          : invalidDate();
      } catch {
        return invalidDate();
      }
    }
    if (typeof timestamp.seconds === "number") {
      const milliseconds =
        timestamp.seconds * 1000 +
        (typeof timestamp.nanoseconds === "number"
          ? timestamp.nanoseconds / 1_000_000
          : 0);
      return Number.isFinite(milliseconds)
        ? new Date(milliseconds)
        : invalidDate();
    }
  }
  return invalidDate();
};

const normalizeAuthorizationInstant = (value: unknown): Date | null => {
  const normalized = normalizeAuthorizationSourceDate(value);
  if (normalized === null || normalized instanceof Date) return normalized;
  if (!ISO_TIMESTAMP_PATTERN.test(normalized)) return invalidDate();
  const milliseconds = Date.parse(normalized);
  return Number.isFinite(milliseconds) ? new Date(milliseconds) : invalidDate();
};

const calendarDateIsValid = (value: string): boolean => {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
};

const dateOnlyKey = (date: Date): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: AUTHORIZATION_DATE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

const boundaryIsActive = (
  value: AuthorizationDate | null | undefined,
  now: Date,
  boundary: "FROM" | "UNTIL",
  optional: boolean,
): boolean => {
  if (value === undefined) return optional;
  if (value === null) return true;
  if (value instanceof Date) {
    const time = value.getTime();
    return (
      Number.isFinite(time) &&
      (boundary === "FROM" ? now.getTime() >= time : now.getTime() <= time)
    );
  }
  if (DATE_ONLY_PATTERN.test(value)) {
    if (!calendarDateIsValid(value)) return false;
    const today = dateOnlyKey(now);
    return boundary === "FROM" ? today >= value : today <= value;
  }
  if (!ISO_TIMESTAMP_PATTERN.test(value)) return false;
  const time = Date.parse(value);
  return (
    Number.isFinite(time) &&
    (boundary === "FROM" ? now.getTime() >= time : now.getTime() <= time)
  );
};

export const authorizationSourceWindowIsActive = (
  validFrom: AuthorizationDate | null | undefined,
  validUntil: AuthorizationDate | null | undefined,
  now: Date,
  optional = false,
): boolean =>
  Number.isFinite(now.getTime()) &&
  boundaryIsActive(validFrom, now, "FROM", optional) &&
  boundaryIsActive(validUntil, now, "UNTIL", optional);

const optionalDate = (data: Readonly<Record<string, unknown>>, key: string) =>
  hasOwn(data, key) ? normalizeAuthorizationSourceDate(data[key]) : undefined;

export const mapAuthorizationUserActor = (
  actorId: string,
  user: AuthorizationSourceDocument | null,
): AuthorizationActor | null => {
  if (
    !user ||
    user.id !== actorId ||
    user.data.status !== UserStatus.ACTIVE ||
    user.data.is_deleted !== false
  ) {
    return null;
  }
  const workplace = user.data.workplace_facility_id;
  return {
    id: actorId,
    status: UserStatus.ACTIVE,
    is_deleted: false,
    workplace_facility_id: isAuthorizationSourceId(workplace)
      ? workplace
      : null,
  };
};

export const mapAuthorizationActor = (
  actorId: string,
  user: AuthorizationSourceDocument | null,
  profiles: readonly AuthorizationSourceDocument[],
): AuthorizationActor | null => {
  const candidate = mapAuthorizationUserActor(actorId, user);
  if (!candidate) return null;

  const activeProfiles = profiles.filter(
    ({ data }) =>
      data.user_id === actorId &&
      data.status === EmployeeProfileStatus.ACTIVE &&
      data.is_deleted === false,
  );
  if (activeProfiles.length !== 1) return null;

  const profile = activeProfiles[0].data;
  const profileWorkplace = hasOwn(profile, "workplace_facility_id")
    ? profile.workplace_facility_id
    : profile.workplace_warehouse_id;
  if (!isAuthorizationSourceId(profileWorkplace)) return null;

  const workplace = user?.data.workplace_facility_id;
  if (
    workplace !== null &&
    (!isAuthorizationSourceId(workplace) || workplace !== profileWorkplace)
  ) {
    return null;
  }
  return {
    ...candidate,
    workplace_facility_id: workplace as string | null,
  };
};

const mapPermissions = (value: unknown): Record<string, boolean> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          ([, enabled]) => typeof enabled === "boolean",
        ),
      )
    : {};

export const mapAuthorizationAssignments = (
  documents: readonly AuthorizationSourceDocument[],
): AuthorizationAssignment[] =>
  documents.map(({ id, data }) => ({
    id,
    user_id: data.user_id as string,
    warehouse_id: data.warehouse_id as string | null,
    role_id: data.role_id as string,
    is_active: data.is_active as boolean,
    is_deleted: data.is_deleted as boolean | undefined,
    scope_origin: data.scope_origin as AuthorizationAssignment["scope_origin"],
    valid_from: normalizeAuthorizationSourceDate(data.valid_from),
    valid_until: normalizeAuthorizationSourceDate(data.valid_until),
  }));

export const mapAuthorizationRoles = (
  documents: readonly AuthorizationSourceDocument[],
): AuthorizationRole[] =>
  documents.map(({ id, data }) => ({
    id,
    name: typeof data.name === "string" ? data.name : "",
    permissions: mapPermissions(data.permissions),
    is_deleted: data.is_deleted as boolean,
    is_active: data.is_active as boolean | undefined,
    status: data.status as ActiveStatus | undefined,
    valid_from: optionalDate(data, "valid_from"),
    valid_until: optionalDate(data, "valid_until"),
  }));

export const mapAuthorizationFacilities = (
  documents: readonly AuthorizationSourceDocument[],
  now: Date,
): AuthorizationFacility[] =>
  documents
    .map(({ id, data }) => ({
      id,
      type: data.type as WarehouseType,
      status: data.status as ActiveStatus,
      is_deleted: data.is_deleted as boolean,
      is_active: data.is_active as boolean | undefined,
      valid_from: optionalDate(data, "valid_from"),
      valid_until: optionalDate(data, "valid_until"),
    }))
    .filter(
      (facility) =>
        isAuthorizationSourceId(facility.id) &&
        facility.is_deleted === false &&
        facility.status === ActiveStatus.ACTIVE &&
        (facility.type === WarehouseType.MAIN ||
          facility.type === WarehouseType.STORE ||
          facility.type === WarehouseType.OFFICE) &&
        (facility.is_active === undefined || facility.is_active === true) &&
        authorizationSourceWindowIsActive(
          facility.valid_from,
          facility.valid_until,
          now,
          true,
        ),
    );

export const mapAuthorizationOfficeConfig = (
  document: AuthorizationSourceDocument | null,
): AuthorizationOfficeScopeConfig | null => {
  if (!document) return null;
  const { id, data } = document;
  return {
    id,
    office_id: data.office_id as string,
    scope_mode: data.scope_mode as AuthorizationOfficeScopeConfig["scope_mode"],
    is_active: data.is_active as boolean,
    is_deleted: data.is_deleted as boolean,
    policy_version: data.policy_version as string,
    revision: data.revision as number,
    valid_from: normalizeAuthorizationInstant(data.valid_from),
    valid_until: normalizeAuthorizationInstant(data.valid_until),
  };
};

export const mapAuthorizationOfficeEdges = (
  documents: readonly AuthorizationSourceDocument[],
): AuthorizationOfficeScopeEdge[] =>
  documents.map(({ id, data }) => ({
    id,
    office_id: data.office_id as string,
    target_facility_id: data.target_facility_id as string,
    is_active: data.is_active as boolean,
    is_deleted: data.is_deleted as boolean,
    valid_from: normalizeAuthorizationInstant(data.valid_from),
    valid_until: normalizeAuthorizationInstant(data.valid_until),
  }));
