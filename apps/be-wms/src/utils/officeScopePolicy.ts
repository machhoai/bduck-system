import {
  ActiveStatus,
  WarehouseType,
  type OfficeScopeConfig,
  type OfficeScopeEdge,
  type Warehouse,
} from "@bduck/shared-types";

export type OfficeScopeFacilityState = Pick<
  Warehouse,
  "id" | "type" | "status" | "is_deleted"
>;

export type PersistedOfficeScopeEdgeState = Pick<
  OfficeScopeEdge,
  "id" | "office_id" | "is_active" | "is_deleted"
>;

const assertValidRange = (
  record: Pick<
    OfficeScopeConfig | OfficeScopeEdge,
    "valid_from" | "valid_until"
  >,
  errorCode: string,
): void => {
  if (
    record.valid_from !== null &&
    record.valid_until !== null &&
    record.valid_until.getTime() < record.valid_from.getTime()
  ) {
    throw new Error(errorCode);
  }
};

export const assertOfficeScopeWriteStructure = (
  config: OfficeScopeConfig,
  edges: OfficeScopeEdge[],
  softDeleteEdgeIds: string[],
): void => {
  if (config.id !== config.office_id) {
    throw new Error("OFFICE_SCOPE_CONFIG_ID_MUST_EQUAL_OFFICE_ID");
  }
  assertValidRange(config, "OFFICE_SCOPE_CONFIG_INVALID_VALIDITY_RANGE");

  if (config.scope_mode === "ALL" && edges.length > 0) {
    throw new Error("OFFICE_SCOPE_ALL_EDGES_NOT_ALLOWED");
  }

  const edgeIds = new Set<string>();
  const targetFacilityIds = new Set<string>();
  edges.forEach((edge) => {
    if (edge.office_id !== config.office_id) {
      throw new Error("OFFICE_SCOPE_EDGE_OFFICE_MISMATCH");
    }
    if (edge.target_facility_id === config.office_id) {
      throw new Error("OFFICE_SCOPE_EDGE_SELF_TARGET_NOT_ALLOWED");
    }
    if (edgeIds.has(edge.id)) {
      throw new Error("OFFICE_SCOPE_EDGE_ID_DUPLICATE");
    }
    if (targetFacilityIds.has(edge.target_facility_id)) {
      throw new Error("OFFICE_SCOPE_EDGE_TARGET_DUPLICATE");
    }
    assertValidRange(edge, "OFFICE_SCOPE_EDGE_INVALID_VALIDITY_RANGE");
    edgeIds.add(edge.id);
    targetFacilityIds.add(edge.target_facility_id);
  });

  if (softDeleteEdgeIds.some((edgeId) => edgeIds.has(edgeId))) {
    throw new Error("OFFICE_SCOPE_EDGE_WRITE_CONFLICT");
  }
};

export const assertPersistedOfficeScopeEdgeOwner = (
  exists: boolean,
  persistedOfficeId: unknown,
  officeId: string,
  allowMissing: boolean,
): void => {
  if (!exists) {
    if (allowMissing) return;
    throw new Error("OFFICE_SCOPE_EDGE_NOT_FOUND");
  }
  if (persistedOfficeId !== officeId) {
    throw new Error("OFFICE_SCOPE_EDGE_OWNER_MISMATCH");
  }
};

export const assertOfficeScopeFacilities = (
  officeId: string,
  officeFacility: OfficeScopeFacilityState | null,
  edges: OfficeScopeEdge[],
  targetFacilities: ReadonlyMap<string, OfficeScopeFacilityState | null>,
): void => {
  if (!officeFacility) throw new Error("OFFICE_SCOPE_OFFICE_NOT_FOUND");
  if (officeFacility.id !== officeId) {
    throw new Error("OFFICE_SCOPE_OFFICE_ID_MISMATCH");
  }
  if (officeFacility.is_deleted) {
    throw new Error("OFFICE_SCOPE_OFFICE_DELETED");
  }
  if (officeFacility.status !== ActiveStatus.ACTIVE) {
    throw new Error("OFFICE_SCOPE_OFFICE_INACTIVE");
  }
  if (officeFacility.type !== WarehouseType.OFFICE) {
    throw new Error("OFFICE_SCOPE_SOURCE_MUST_BE_OFFICE");
  }

  edges.forEach((edge) => {
    const target = targetFacilities.get(edge.target_facility_id) ?? null;
    if (!target) throw new Error("OFFICE_SCOPE_TARGET_NOT_FOUND");
    if (target.id !== edge.target_facility_id) {
      throw new Error("OFFICE_SCOPE_TARGET_ID_MISMATCH");
    }
    if (target.id === officeId) {
      throw new Error("OFFICE_SCOPE_EDGE_SELF_TARGET_NOT_ALLOWED");
    }
    if (target.is_deleted) throw new Error("OFFICE_SCOPE_TARGET_DELETED");
    if (target.status !== ActiveStatus.ACTIVE) {
      throw new Error("OFFICE_SCOPE_TARGET_INACTIVE");
    }
    if (
      target.type !== WarehouseType.MAIN &&
      target.type !== WarehouseType.STORE
    ) {
      throw new Error("OFFICE_SCOPE_TARGET_TYPE_NOT_MANAGEABLE");
    }
  });
};

export const collectAllModeSoftDeleteEdgeIds = (
  config: OfficeScopeConfig,
  persistedEdges: PersistedOfficeScopeEdgeState[],
): string[] => {
  if (config.scope_mode !== "ALL") return [];

  const edgeIds = new Set<string>();
  persistedEdges.forEach((edge) => {
    if (edge.office_id !== config.office_id) {
      throw new Error("OFFICE_SCOPE_EDGE_OWNER_MISMATCH");
    }
    if (edge.is_active && !edge.is_deleted) edgeIds.add(edge.id);
  });
  return Array.from(edgeIds).sort();
};
