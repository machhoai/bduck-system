import { ActiveStatus, UserStatus, WarehouseType } from "@bduck/shared-types";
import type {
  AuthorizationActor,
  AuthorizationDate,
  AuthorizationFacility,
  AuthorizationRole,
} from "./authorizationTypes.js";

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/;

const isCalendarDate = (value: string): boolean => {
  const [year, month, day] = value.split("-").map(Number);
  const normalized = new Date(Date.UTC(year, month - 1, day));
  return (
    normalized.getUTCFullYear() === year &&
    normalized.getUTCMonth() === month - 1 &&
    normalized.getUTCDate() === day
  );
};

const parseStrictIsoTimestamp = (value: string): number | null => {
  const match = ISO_TIMESTAMP_PATTERN.exec(value);
  if (!match || !isCalendarDate(`${match[1]}-${match[2]}-${match[3]}`)) {
    return null;
  }
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[8] ? Number(match[9]) : 0;
  const offsetMinute = match[8] ? Number(match[10]) : 0;
  if (
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    offsetHour > 14 ||
    offsetMinute > 59 ||
    (offsetHour === 14 && offsetMinute !== 0)
  ) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
};

const dateOnlyKey = (date: Date, timeZone: string): string => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const boundaryAllows = (
  value: AuthorizationDate | null,
  now: Date,
  timeZone: string,
  boundary: "FROM" | "UNTIL",
): boolean => {
  if (value === null) return true;
  if (typeof value === "string" && DATE_ONLY_PATTERN.test(value)) {
    if (!isCalendarDate(value)) return false;
    const today = dateOnlyKey(now, timeZone);
    return boundary === "FROM" ? today >= value : today <= value;
  }

  const timestamp =
    value instanceof Date ? value.getTime() : parseStrictIsoTimestamp(value);
  if (timestamp === null || !Number.isFinite(timestamp)) return false;
  return boundary === "FROM"
    ? now.getTime() >= timestamp
    : now.getTime() <= timestamp;
};

export const isActiveValidityWindow = (
  validFrom: AuthorizationDate | null,
  validUntil: AuthorizationDate | null,
  now: Date,
  timeZone: string,
): boolean =>
  boundaryAllows(validFrom, now, timeZone, "FROM") &&
  boundaryAllows(validUntil, now, timeZone, "UNTIL");

export const isActiveActor = (actor: AuthorizationActor): boolean =>
  actor.status === UserStatus.ACTIVE && actor.is_deleted === false;

export const isActiveFacility = (
  facility: AuthorizationFacility,
  now: Date,
  timeZone: string,
): boolean =>
  facility.status === ActiveStatus.ACTIVE &&
  (facility.type === WarehouseType.MAIN ||
    facility.type === WarehouseType.STORE ||
    facility.type === WarehouseType.OFFICE) &&
  (facility.is_active === undefined || facility.is_active === true) &&
  facility.is_deleted === false &&
  isActiveValidityWindow(
    facility.valid_from ?? null,
    facility.valid_until ?? null,
    now,
    timeZone,
  );

export const isActiveRole = (
  role: AuthorizationRole,
  now: Date,
  timeZone: string,
): boolean =>
  role.is_deleted === false &&
  (role.is_active === undefined || role.is_active === true) &&
  (role.status === undefined || role.status === ActiveStatus.ACTIVE) &&
  typeof role.permissions === "object" &&
  role.permissions !== null &&
  !Array.isArray(role.permissions) &&
  isActiveValidityWindow(
    role.valid_from ?? null,
    role.valid_until ?? null,
    now,
    timeZone,
  );
