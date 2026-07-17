import {
  ActiveStatus,
  type OfficeScopeHistoryEntry,
  type OfficeScopeSnapshot,
} from "@bduck/shared-types";
import { auditLogRepository } from "../repositories/auditLogRepository.js";
import { getOfficeScopeCeiling } from "../repositories/officeScopeCeilingRepository.js";
import { findOfficeScopeMaterializations } from "../repositories/officeScopeMaterializationRepository.js";
import {
  countActiveEmployeesAtOffice,
  findActiveOfficeScopeEdges,
  getOfficeScopeConfig,
} from "../repositories/officeScopeRepository.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  assertCanReadOfficeScopeHistory,
  buildOfficeScopeHistory,
} from "./officeScopeHistoryPolicy.js";
import {
  assertOfficeFacility,
  getActiveOfficeScopeTargetIds,
  isManageableOfficeFacility,
  resolveEffectiveOfficeScopeIds,
} from "./officeScopeServiceSupport.js";

export const fetchOfficeScope = async (
  officeId: string,
  authorization: AuthorizationService,
): Promise<OfficeScopeSnapshot> => {
  await assertOfficeFacility(officeId);
  authorization.assert("office_scopes.read", officeId);
  const readableIds = authorization.context.isSystemAdmin
    ? []
    : authorization.facilityIdsFor("office_scopes.read");
  const editableIds = authorization.context.isSystemAdmin
    ? []
    : authorization.facilityIdsFor("office_scopes.write");
  const [config, edges, ceiling, affectedEmployeeCount] = await Promise.all([
    getOfficeScopeConfig(officeId),
    findActiveOfficeScopeEdges(officeId),
    getOfficeScopeCeiling(officeId),
    countActiveEmployeesAtOffice(officeId),
  ]);
  const selectedIds = getActiveOfficeScopeTargetIds(edges);
  const shouldLoadAll =
    authorization.context.isSystemAdmin ||
    config?.scope_mode === "ALL" ||
    ceiling?.scope_mode === "ALL";
  const facilities = await warehouseRepository.findWarehousesScoped({
    isSystemAdmin: shouldLoadAll,
    facilityIds: shouldLoadAll
      ? []
      : Array.from(
          new Set([
            ...readableIds,
            ...editableIds,
            ...selectedIds,
            ...(ceiling?.target_facility_ids ?? []),
          ]),
        ),
  });
  const manageable = facilities.filter(
    (facility) =>
      facility.status === ActiveStatus.ACTIVE &&
      isManageableOfficeFacility(facility.type),
  );
  const manageableIds = new Set(manageable.map((facility) => facility.id));
  const effectiveFacilityIds = resolveEffectiveOfficeScopeIds(
    config?.scope_mode ?? null,
    selectedIds,
    manageableIds,
  );
  const ceilingFacilityIds = resolveEffectiveOfficeScopeIds(
    ceiling?.scope_mode ?? null,
    ceiling?.target_facility_ids ?? [],
    manageableIds,
  );
  const writableIds = authorization.context.isSystemAdmin
    ? Array.from(manageableIds).sort()
    : ceilingFacilityIds;
  const writableSet = new Set(writableIds);
  return {
    config,
    ceiling,
    edges,
    effective_facility_ids: effectiveFacilityIds,
    editable_facility_ids: writableIds,
    editable_facilities: manageable
      .filter((facility) => writableSet.has(facility.id))
      .map(({ id, name, code, type, status }) => ({
        id,
        name,
        code,
        type,
        status,
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
    affected_employee_count: affectedEmployeeCount,
  };
};

export const fetchOfficeScopeHistory = async (
  officeId: string,
  authorization: AuthorizationService,
  limit = 20,
): Promise<OfficeScopeHistoryEntry[]> => {
  await assertOfficeFacility(officeId);
  assertCanReadOfficeScopeHistory(authorization, officeId);
  const logs = await auditLogRepository.findAuditLogs({
    entity_type: "office_scope_configs",
    entity_id: officeId,
    limit,
    offset: 0,
    sort_by: "sync_time",
    sort_dir: "desc",
  });
  const history = buildOfficeScopeHistory(logs, officeId);
  const statuses = await findOfficeScopeMaterializations(
    officeId,
    history.map((entry) => entry.revision),
  );
  return history.map((entry) => ({
    ...entry,
    materialization: statuses.get(entry.revision) ?? null,
  }));
};
