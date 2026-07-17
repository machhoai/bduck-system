import type { ISOTimestamped, SoftDeletable } from "./utility.js";

export const AUTHORIZATION_SHADOW_DIFFS_COLLECTION =
  "authorization_shadow_diffs" as const;

export const AUTHORIZATION_ROLLOUT_MODES = ["SHADOW", "MATERIALIZED"] as const;
export type AuthorizationRolloutMode =
  (typeof AUTHORIZATION_ROLLOUT_MODES)[number];

export const AUTHORIZATION_SHADOW_OUTCOMES = [
  "MISMATCH",
  "MATERIALIZED_MISSING",
  "MATERIALIZED_INVALID",
] as const;
export type AuthorizationShadowOutcome =
  (typeof AUTHORIZATION_SHADOW_OUTCOMES)[number];

export interface AuthorizationContextSummary {
  actor_id: string;
  workplace_facility_id: string | null;
  is_system_admin: boolean;
  policy_version: string;
  facility_ids: string[];
  permission_count: number;
  source_count: number;
  fingerprint: string;
}

/** Aggregated shadow discrepancy. The deterministic id makes retries safe. */
export interface AuthorizationShadowDiff extends SoftDeletable, ISOTimestamped {
  id: string;
  actor_id: string;
  outcome: AuthorizationShadowOutcome;
  differing_fields: string[];
  live_context: AuthorizationContextSummary;
  materialized_context: AuthorizationContextSummary | null;
  error_code: string | null;
  observation_count: number;
  first_observed_at: Date;
  last_observed_at: Date;
}
