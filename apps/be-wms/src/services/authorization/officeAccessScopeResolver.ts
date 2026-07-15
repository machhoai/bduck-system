import {
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
} from "@bduck/shared-types";
import type {
  AuthorizationFacility,
  AuthorizationOfficeScopeConfig,
  AuthorizationSourceSnapshot,
} from "./authorizationTypes.js";
import { isActiveValidityWindow } from "./authorizationValidity.js";

const activeOfficeConfig = (
  snapshot: AuthorizationSourceSnapshot,
  officeId: string,
  now: Date,
  timeZone: string,
): AuthorizationOfficeScopeConfig | null => {
  const candidates = snapshot.officeScopeConfigs.filter(
    (config) =>
      config.id === officeId &&
      config.office_id === officeId &&
      config.is_active === true &&
      config.is_deleted === false &&
      config.policy_version === FACILITY_ACCESS_POLICY_VERSION &&
      Number.isInteger(config.revision) &&
      config.revision > 0 &&
      isActiveValidityWindow(
        config.valid_from,
        config.valid_until,
        now,
        timeZone,
      ),
  );
  return candidates.length === 1 ? candidates[0] : null;
};

const isManageable = (facility: AuthorizationFacility): boolean =>
  facility.type === WarehouseType.MAIN || facility.type === WarehouseType.STORE;

export const resolveManagedFacilityIds = (
  snapshot: AuthorizationSourceSnapshot,
  officeId: string,
  activeFacilities: ReadonlyMap<string, AuthorizationFacility>,
  now: Date,
  timeZone: string,
): Set<string> => {
  const config = activeOfficeConfig(snapshot, officeId, now, timeZone);
  if (!config) return new Set();
  if (config.scope_mode === "ALL") {
    return new Set(
      Array.from(activeFacilities.values())
        .filter(isManageable)
        .map((facility) => facility.id),
    );
  }
  if (config.scope_mode !== "SELECTED") return new Set();

  const result = new Set<string>();
  snapshot.officeScopeEdges.forEach((edge) => {
    if (
      edge.office_id !== officeId ||
      edge.is_active !== true ||
      edge.is_deleted !== false ||
      !isActiveValidityWindow(edge.valid_from, edge.valid_until, now, timeZone)
    ) {
      return;
    }
    const target = activeFacilities.get(edge.target_facility_id);
    if (target && isManageable(target)) result.add(target.id);
  });
  return result;
};
