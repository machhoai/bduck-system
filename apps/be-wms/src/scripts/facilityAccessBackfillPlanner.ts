import {
  ActiveStatus,
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
  type OfficeScopeConfig,
} from "@bduck/shared-types";
import type {
  BackfillIssue,
  BackfillIssueCode,
} from "./facilityAccessBackfillTypes.js";

export type DocumentData = Record<string, unknown>;

export interface DocumentInput {
  id: string;
  data: DocumentData;
}

export interface EntityPlan {
  patch: DocumentData | null;
  issues: BackfillIssue[];
}

export interface UserPlan extends EntityPlan {
  workplaceFacilityId: string | null;
}

const stringValue = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const issue = (
  code: BackfillIssueCode,
  entityType: string,
  entityId: string,
  detail: string,
): BackfillIssue => ({
  code,
  entity_type: entityType,
  entity_id: entityId,
  detail,
});

export const planUserBackfill = ({
  user,
  profiles,
  workplaceFacility,
  now,
}: {
  user: DocumentInput;
  profiles: DocumentInput[];
  workplaceFacility: DocumentInput | null;
  now: Date;
}): UserPlan => {
  if (user.data.is_deleted === true) {
    return {
      patch: null,
      workplaceFacilityId: null,
      issues: [
        issue(
          "DELETED_USER_SKIPPED",
          "users",
          user.id,
          "Soft-deleted user was intentionally left unchanged.",
        ),
      ],
    };
  }

  const activeProfiles = profiles.filter(
    ({ data }) => data.is_deleted !== true && data.status === "ACTIVE",
  );

  if (activeProfiles.length !== 1) {
    let code: BackfillIssueCode = "NO_ACTIVE_PROFILE";
    if (profiles.length === 0) code = "ORPHAN_USER_NO_PROFILE";
    else if (profiles.every(({ data }) => data.is_deleted === true)) {
      code = "ONLY_DELETED_PROFILES";
    } else if (activeProfiles.length > 1) {
      code = "DUPLICATE_ACTIVE_PROFILES";
    }

    return {
      patch: null,
      workplaceFacilityId: null,
      issues: [
        issue(
          code,
          "users",
          user.id,
          `Expected one active profile; found ${activeProfiles.length} active of ${profiles.length} total.`,
        ),
      ],
    };
  }

  const profile = activeProfiles[0];
  const workplaceFacilityId = stringValue(profile.data.workplace_warehouse_id);
  if (!workplaceFacilityId) {
    return {
      patch: null,
      workplaceFacilityId: null,
      issues: [
        issue(
          "PROFILE_MISSING_WORKPLACE",
          "employee_profiles",
          profile.id,
          "Active profile has no workplace_warehouse_id.",
        ),
      ],
    };
  }

  if (!workplaceFacility) {
    return {
      patch: null,
      workplaceFacilityId,
      issues: [
        issue(
          "WORKPLACE_FACILITY_NOT_FOUND",
          "employee_profiles",
          profile.id,
          `Facility ${workplaceFacilityId} does not exist.`,
        ),
      ],
    };
  }

  if (workplaceFacility.data.is_deleted === true) {
    return {
      patch: null,
      workplaceFacilityId,
      issues: [
        issue(
          "WORKPLACE_FACILITY_DELETED",
          "employee_profiles",
          profile.id,
          `Facility ${workplaceFacilityId} is soft-deleted.`,
        ),
      ],
    };
  }

  if (workplaceFacility.data.status !== ActiveStatus.ACTIVE) {
    return {
      patch: null,
      workplaceFacilityId,
      issues: [
        issue(
          "WORKPLACE_FACILITY_INACTIVE",
          "employee_profiles",
          profile.id,
          `Facility ${workplaceFacilityId} is inactive.`,
        ),
      ],
    };
  }

  const currentWorkplace = stringValue(user.data.workplace_facility_id);
  if (currentWorkplace && currentWorkplace !== workplaceFacilityId) {
    return {
      patch: null,
      workplaceFacilityId,
      issues: [
        issue(
          "WORKPLACE_CONFLICT",
          "users",
          user.id,
          `Existing ${currentWorkplace} differs from profile ${workplaceFacilityId}; no overwrite was performed.`,
        ),
      ],
    };
  }

  return {
    patch: currentWorkplace
      ? null
      : { workplace_facility_id: workplaceFacilityId, updated_at: now },
    workplaceFacilityId,
    issues: [],
  };
};

export const planLegacyAssignment = (
  assignment: DocumentInput,
  now: Date,
): EntityPlan => {
  const origin = stringValue(assignment.data.scope_origin);
  const issues: BackfillIssue[] = [];

  if (origin && origin !== "DIRECT" && origin !== "LEGACY_DIRECT") {
    issues.push(
      issue(
        "INVALID_ASSIGNMENT_SCOPE_ORIGIN",
        "user_warehouse_roles",
        assignment.id,
        `Unknown scope_origin ${origin}; no overwrite was performed.`,
      ),
    );
    return { patch: null, issues };
  }

  if (!origin && assignment.data.warehouse_id == null) {
    issues.push(
      issue(
        "LEGACY_GLOBAL_ASSIGNMENT_PRESERVED",
        "user_warehouse_roles",
        assignment.id,
        "Null warehouse_id was preserved and tagged LEGACY_DIRECT; no global or office scope was inferred.",
      ),
    );
  }

  return {
    patch: origin ? null : { scope_origin: "LEGACY_DIRECT", updated_at: now },
    issues,
  };
};

export const planOfficeScopeConfig = ({
  facility,
  existingConfig,
  initiatedBy,
  now,
}: {
  facility: DocumentInput;
  existingConfig: DocumentInput | null;
  initiatedBy: string;
  now: Date;
}): { config: OfficeScopeConfig | null; issues: BackfillIssue[] } => {
  if (facility.data.type !== WarehouseType.OFFICE) {
    return { config: null, issues: [] };
  }
  if (facility.data.is_deleted === true) {
    return {
      config: null,
      issues: [
        issue(
          "DELETED_OFFICE_SKIPPED",
          "warehouses",
          facility.id,
          "Soft-deleted office was not assigned a scope configuration.",
        ),
      ],
    };
  }
  if (existingConfig) {
    return {
      config: null,
      issues:
        existingConfig.data.is_deleted === true
          ? [
              issue(
                "DELETED_OFFICE_CONFIG_CONFLICT",
                "office_scope_configs",
                facility.id,
                "A soft-deleted configuration already occupies the deterministic office ID.",
              ),
            ]
          : [],
    };
  }

  return {
    config: {
      id: facility.id,
      office_id: facility.id,
      scope_mode: "SELECTED",
      is_active: true,
      policy_version: FACILITY_ACCESS_POLICY_VERSION,
      revision: 1,
      valid_from: null,
      valid_until: null,
      created_by: initiatedBy,
      updated_by: initiatedBy,
      is_deleted: false,
      created_at: now,
      updated_at: now,
      action_time: now,
      sync_time: now,
    },
    issues: [],
  };
};
