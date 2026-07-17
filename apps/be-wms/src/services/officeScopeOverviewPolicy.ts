import {
  ActiveStatus,
  WarehouseType,
  type OfficeScopeConfig,
  type OfficeScopeEdge,
  type OfficeScopeOverviewItem,
  type Warehouse,
} from "@bduck/shared-types";
import type { AuthorizationService } from "./authorization/index.js";

type OverviewInput = {
  facilities: Warehouse[];
  configs: OfficeScopeConfig[];
  edges: OfficeScopeEdge[];
  employeeCounts: Record<string, number>;
  at?: Date;
};

const isEffectiveAt = (
  record: Pick<
    OfficeScopeConfig | OfficeScopeEdge,
    "is_active" | "is_deleted" | "valid_from" | "valid_until"
  >,
  at: Date,
) =>
  record.is_active &&
  !record.is_deleted &&
  (record.valid_from === null || record.valid_from.getTime() <= at.getTime()) &&
  (record.valid_until === null || at.getTime() <= record.valid_until.getTime());

export const createOfficeScopeOverviewReadScope = (
  authorization: AuthorizationService,
) => ({
  isSystemAdmin: authorization.context.isSystemAdmin,
  facilityIds: authorization.context.isSystemAdmin
    ? []
    : authorization.facilityIdsFor("office_scopes.read"),
});

export const buildOfficeScopeOverview = ({
  facilities,
  configs,
  edges,
  employeeCounts,
  at = new Date(),
}: OverviewInput): OfficeScopeOverviewItem[] => {
  const offices = facilities.filter(
    (facility) => facility.type === WarehouseType.OFFICE,
  );
  const manageableIds = new Set(
    facilities
      .filter(
        (facility) =>
          !facility.is_deleted &&
          facility.status === ActiveStatus.ACTIVE &&
          (facility.type === WarehouseType.MAIN ||
            facility.type === WarehouseType.STORE),
      )
      .map((facility) => facility.id),
  );
  const configsByOffice = new Map(
    configs.map((config) => [config.office_id, config]),
  );

  return offices
    .map((office): OfficeScopeOverviewItem => {
      const config = configsByOffice.get(office.id) ?? null;
      const configIsEffective = Boolean(config && isEffectiveAt(config, at));
      const selectedCount = new Set(
        edges
          .filter(
            (edge) =>
              edge.office_id === office.id &&
              isEffectiveAt(edge, at) &&
              manageableIds.has(edge.target_facility_id),
          )
          .map((edge) => edge.target_facility_id),
      ).size;
      const effectiveCount = !configIsEffective
        ? 0
        : config?.scope_mode === "ALL"
          ? manageableIds.size
          : selectedCount;
      const scopeStatus = !config
        ? "UNCONFIGURED"
        : !configIsEffective
          ? "INACTIVE"
          : effectiveCount === 0
            ? "EMPTY"
            : "ACTIVE";

      return {
        office_id: office.id,
        office_name: office.name,
        office_code: office.code,
        office_status: office.status,
        scope_status: scopeStatus,
        scope_mode: config?.scope_mode ?? null,
        revision: config?.revision ?? 0,
        effective_facility_count: effectiveCount,
        affected_employee_count: employeeCounts[office.id] ?? 0,
        updated_at: config?.updated_at ?? null,
      };
    })
    .sort((left, right) =>
      left.office_name.localeCompare(right.office_name, "vi"),
    );
};
