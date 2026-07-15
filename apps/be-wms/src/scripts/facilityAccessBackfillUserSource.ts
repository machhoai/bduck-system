import { ActiveStatus } from "@bduck/shared-types";
import { BackfillPreconditionConflictError } from "./facilityAccessBackfillErrors.js";
import type {
  DocumentData,
  DocumentInput,
} from "./facilityAccessBackfillPlanner.js";

const workplaceIdFrom = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const assertUserWorkplaceSourceSnapshot = ({
  currentUser,
  profiles,
  workplaceFacility,
  expectedWorkplaceId,
}: {
  currentUser: DocumentData;
  profiles: DocumentInput[];
  workplaceFacility: DocumentInput | null;
  expectedWorkplaceId: string;
}): void => {
  const activeProfiles = profiles.filter(
    ({ data }) => data.is_deleted !== true && data.status === "ACTIVE",
  );
  if (activeProfiles.length !== 1) {
    throw new BackfillPreconditionConflictError(
      `WORKPLACE_SOURCE_ACTIVE_PROFILE_COUNT_CHANGED:${activeProfiles.length}`,
    );
  }

  const profileWorkplaceId = workplaceIdFrom(
    activeProfiles[0]?.data.workplace_warehouse_id,
  );
  if (profileWorkplaceId !== expectedWorkplaceId) {
    throw new BackfillPreconditionConflictError(
      "WORKPLACE_SOURCE_PROFILE_CHANGED",
    );
  }

  const userWorkplaceId = workplaceIdFrom(currentUser.workplace_facility_id);
  if (userWorkplaceId && userWorkplaceId !== expectedWorkplaceId) {
    throw new BackfillPreconditionConflictError(
      "WORKPLACE_SOURCE_USER_CHANGED",
    );
  }

  if (
    !workplaceFacility ||
    workplaceFacility.id !== expectedWorkplaceId ||
    workplaceFacility.data.is_deleted === true ||
    workplaceFacility.data.status !== ActiveStatus.ACTIVE
  ) {
    throw new BackfillPreconditionConflictError(
      "WORKPLACE_SOURCE_FACILITY_UNAVAILABLE",
    );
  }
};
