import {
  ActiveStatus,
  FACILITY_ACCESS_POLICY_VERSION,
  type OfficeScopeConfig,
  type OfficeScopeEdge,
} from "@bduck/shared-types";
import { randomUUID } from "crypto";
import { getOfficeScopeCeiling } from "../repositories/officeScopeCeilingRepository.js";
import {
  createOfficeScopeWritePlan,
  findOfficeScopeEdges,
  getOfficeScopeConfig,
} from "../repositories/officeScopeRepository.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";
import type { OfficeScopeMutationInput } from "../utils/facilityAccessSchemas.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  assertCanAdministerOfficeScope,
  assertExpectedOfficeScopeRevision,
  assertOfficeScopeWithinCeiling,
} from "./officeScopeAdministrationPolicy.js";
import { applyOfficeScopeChange } from "./officeScopeMaterializationService.js";
import { fetchOfficeScope } from "./officeScopeReadService.js";
import {
  assertOfficeFacility,
  getActiveOfficeScopeTargetIds,
  isManageableOfficeFacility,
  resolveEffectiveOfficeScopeIds,
} from "./officeScopeServiceSupport.js";

const createScopeRecords = ({
  officeId,
  actorId,
  input,
  existingConfig,
  existingEdges,
  now,
}: {
  officeId: string;
  actorId: string;
  input: OfficeScopeMutationInput;
  existingConfig: OfficeScopeConfig | null;
  existingEdges: OfficeScopeEdge[];
  now: Date;
}) => {
  const selectedIds = new Set(input.target_facility_ids);
  const existingByTarget = new Map(
    existingEdges.map((edge) => [edge.target_facility_id, edge]),
  );
  const config: OfficeScopeConfig = {
    id: officeId,
    office_id: officeId,
    scope_mode: input.scope_mode,
    is_active: true,
    policy_version: FACILITY_ACCESS_POLICY_VERSION,
    revision: input.expected_revision + 1,
    valid_from: input.valid_from ?? null,
    valid_until: input.valid_until ?? null,
    created_by: existingConfig?.created_by ?? actorId,
    updated_by: actorId,
    is_deleted: false,
    created_at: existingConfig?.created_at ?? now,
    updated_at: now,
    action_time: input.action_time ?? now,
    sync_time: now,
  };
  const edges: OfficeScopeEdge[] =
    input.scope_mode === "SELECTED"
      ? Array.from(selectedIds).map((targetId) => {
          const existing = existingByTarget.get(targetId);
          return {
            id: existing?.id ?? randomUUID(),
            office_id: officeId,
            target_facility_id: targetId,
            is_active: true,
            valid_from: input.valid_from ?? null,
            valid_until: input.valid_until ?? null,
            created_by: existing?.created_by ?? actorId,
            updated_by: actorId,
            is_deleted: false,
            created_at: existing?.created_at ?? now,
            updated_at: now,
            action_time: input.action_time ?? now,
            sync_time: now,
          };
        })
      : [];
  const writtenIds = new Set(edges.map((edge) => edge.id));
  return createOfficeScopeWritePlan({
    expectedRevision: input.expected_revision,
    config,
    edges,
    softDeleteEdgeIds: existingEdges
      .filter((edge) => !edge.is_deleted && !writtenIds.has(edge.id))
      .map((edge) => edge.id),
    updatedBy: actorId,
    actionTime: input.action_time ?? now,
    syncTime: now,
  });
};

export const updateOfficeScope = async (
  officeId: string,
  input: OfficeScopeMutationInput,
  actorId: string,
  authorization: AuthorizationService,
) => {
  await assertOfficeFacility(officeId);
  assertCanAdministerOfficeScope(authorization, officeId);
  const [existingConfig, existingEdges, ceiling] = await Promise.all([
    getOfficeScopeConfig(officeId, true),
    findOfficeScopeEdges(officeId, true),
    getOfficeScopeCeiling(officeId),
  ]);
  assertExpectedOfficeScopeRevision(
    input.expected_revision,
    existingConfig?.revision ?? 0,
  );
  const activeEdges = existingEdges.filter(
    (edge) => edge.is_active && !edge.is_deleted,
  );
  const shouldLoadAll =
    authorization.context.isSystemAdmin ||
    existingConfig?.scope_mode === "ALL" ||
    ceiling?.scope_mode === "ALL";
  const facilities = await warehouseRepository.findWarehousesScoped({
    isSystemAdmin: shouldLoadAll,
    facilityIds: shouldLoadAll
      ? []
      : Array.from(
          new Set([
            ...getActiveOfficeScopeTargetIds(activeEdges),
            ...(ceiling?.target_facility_ids ?? []),
            ...input.target_facility_ids,
          ]),
        ),
  });
  const manageableIds = new Set(
    facilities
      .filter(
        (facility) =>
          facility.status === ActiveStatus.ACTIVE &&
          isManageableOfficeFacility(facility.type),
      )
      .map((facility) => facility.id),
  );
  const ceilingIds = resolveEffectiveOfficeScopeIds(
    ceiling?.scope_mode ?? null,
    ceiling?.target_facility_ids ?? [],
    manageableIds,
  );
  assertOfficeScopeWithinCeiling({
    authorization,
    officeId,
    nextMode: input.scope_mode,
    nextFacilityIds: input.target_facility_ids,
    ceilingMode: ceiling?.scope_mode ?? null,
    ceilingFacilityIds: ceilingIds,
  });
  const plan = createScopeRecords({
    officeId,
    actorId,
    input,
    existingConfig,
    existingEdges,
    now: new Date(),
  });
  await applyOfficeScopeChange(plan);
  return fetchOfficeScope(officeId, authorization);
};
