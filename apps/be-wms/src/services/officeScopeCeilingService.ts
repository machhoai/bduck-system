import {
  ActiveStatus,
  type OfficeScopeCeilingConfig,
} from "@bduck/shared-types";
import {
  applyOfficeScopeCeiling,
  getOfficeScopeCeiling,
} from "../repositories/officeScopeCeilingRepository.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";
import type { OfficeScopeCeilingMutationInput } from "../utils/facilityAccessSchemas.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  assertCanExpandOfficeScopeCeiling,
  assertExpectedOfficeScopeRevision,
} from "./officeScopeAdministrationPolicy.js";
import { fetchOfficeScope } from "./officeScopeReadService.js";
import {
  assertOfficeFacility,
  isManageableOfficeFacility,
} from "./officeScopeServiceSupport.js";

export const updateOfficeScopeCeiling = async (
  officeId: string,
  input: OfficeScopeCeilingMutationInput,
  actorId: string,
  authorization: AuthorizationService,
) => {
  await assertOfficeFacility(officeId);
  assertCanExpandOfficeScopeCeiling(authorization);
  const [existing, facilities] = await Promise.all([
    getOfficeScopeCeiling(officeId),
    warehouseRepository.findWarehousesScoped({
      isSystemAdmin: true,
      facilityIds: [],
    }),
  ]);
  assertExpectedOfficeScopeRevision(
    input.expected_revision,
    existing?.revision ?? 0,
  );
  const manageableIds = new Set(
    facilities
      .filter(
        (facility) =>
          !facility.is_deleted &&
          facility.status === ActiveStatus.ACTIVE &&
          isManageableOfficeFacility(facility.type),
      )
      .map((facility) => facility.id),
  );
  if (input.target_facility_ids.some((id) => !manageableIds.has(id))) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Trần phạm vi chỉ được chứa kho hoặc cửa hàng đang hoạt động.",
        zh: "范围上限只能包含有效的仓库或门店。",
      },
    };
  }
  const now = new Date();
  const config: OfficeScopeCeilingConfig = {
    id: officeId,
    office_id: officeId,
    scope_mode: input.scope_mode,
    target_facility_ids:
      input.scope_mode === "ALL" ? [] : [...input.target_facility_ids].sort(),
    revision: input.expected_revision + 1,
    created_by: existing?.created_by ?? actorId,
    updated_by: actorId,
    is_deleted: false,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    action_time: now,
    sync_time: now,
  };
  await applyOfficeScopeCeiling(config, input.expected_revision);
  return fetchOfficeScope(officeId, authorization);
};
