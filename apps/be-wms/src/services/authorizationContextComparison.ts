import type { AuthorizationContextSummary } from "@bduck/shared-types";
import type { AccessContext } from "./authorization/index.js";
import {
  createAccessSourceFingerprint,
  materializedSeedFromContext,
} from "./userAccessMaterializationPlan.js";

const sourceKey = (source: {
  type: string;
  role_id: string;
  assignment_id: string;
  office_id: string | null;
}) =>
  JSON.stringify([
    source.type,
    source.role_id,
    source.assignment_id,
    source.office_id,
  ]);

export const summarizeAccessContext = (
  context: AccessContext,
): AuthorizationContextSummary => {
  const facilities = Object.values(context.grants);
  const sources = new Set(context.systemAdminSources.map(sourceKey));
  facilities.forEach((grant) =>
    grant.sources.forEach((source) => sources.add(sourceKey(source))),
  );
  return {
    actor_id: context.actorId,
    workplace_facility_id: context.workplaceFacilityId,
    is_system_admin: context.isSystemAdmin,
    policy_version: context.policyVersion,
    facility_ids: facilities.map((grant) => grant.facilityId).sort(),
    permission_count: facilities.reduce(
      (count, grant) =>
        count + Object.values(grant.permissions).filter(Boolean).length,
      0,
    ),
    source_count: sources.size,
    fingerprint: createAccessSourceFingerprint(
      materializedSeedFromContext(context),
    ),
  };
};

export interface AuthorizationContextComparison {
  matches: boolean;
  differingFields: string[];
  live: AuthorizationContextSummary;
  materialized: AuthorizationContextSummary;
}

export const compareAccessContexts = (
  live: AccessContext,
  materialized: AccessContext,
): AuthorizationContextComparison => {
  const liveSummary = summarizeAccessContext(live);
  const materializedSummary = summarizeAccessContext(materialized);
  const differingFields: string[] = [];
  if (liveSummary.actor_id !== materializedSummary.actor_id)
    differingFields.push("actor_id");
  if (
    liveSummary.workplace_facility_id !==
    materializedSummary.workplace_facility_id
  ) {
    differingFields.push("workplace_facility_id");
  }
  if (liveSummary.is_system_admin !== materializedSummary.is_system_admin) {
    differingFields.push("is_system_admin");
  }
  if (liveSummary.policy_version !== materializedSummary.policy_version) {
    differingFields.push("policy_version");
  }
  if (
    JSON.stringify(liveSummary.facility_ids) !==
    JSON.stringify(materializedSummary.facility_ids)
  ) {
    differingFields.push("facility_ids");
  }
  if (liveSummary.permission_count !== materializedSummary.permission_count) {
    differingFields.push("permissions");
  }
  if (liveSummary.source_count !== materializedSummary.source_count)
    differingFields.push("sources");
  if (liveSummary.fingerprint !== materializedSummary.fingerprint) {
    differingFields.push("grant_fingerprint");
  }
  return {
    matches: differingFields.length === 0,
    differingFields,
    live: liveSummary,
    materialized: materializedSummary,
  };
};
