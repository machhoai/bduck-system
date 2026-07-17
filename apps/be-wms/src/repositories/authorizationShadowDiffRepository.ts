import { createHash } from "node:crypto";
import {
  AUTHORIZATION_SHADOW_DIFFS_COLLECTION,
  type AuthorizationContextSummary,
  type AuthorizationShadowOutcome,
} from "@bduck/shared-types";
import { FieldValue } from "firebase-admin/firestore";
import { db } from "../config/firebase.js";

export interface AuthorizationShadowObservation {
  actorId: string;
  outcome: AuthorizationShadowOutcome;
  differingFields: readonly string[];
  liveContext: AuthorizationContextSummary;
  materializedContext: AuthorizationContextSummary | null;
  errorCode: string | null;
  observedAt: Date;
}

const observationId = (observation: AuthorizationShadowObservation): string =>
  createHash("sha256")
    .update(
      JSON.stringify([
        observation.actorId,
        observation.outcome,
        [...observation.differingFields].sort(),
        observation.liveContext.fingerprint,
        observation.materializedContext?.fingerprint ?? "",
        observation.errorCode ?? "",
      ]),
    )
    .digest("hex");

export const recordAuthorizationShadowObservation = async (
  observation: AuthorizationShadowObservation,
): Promise<void> => {
  const id = observationId(observation);
  const reference = db
    .collection(AUTHORIZATION_SHADOW_DIFFS_COLLECTION)
    .doc(id);
  await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(reference);
    const timestamps = {
      updated_at: observation.observedAt,
      action_time: observation.observedAt,
      sync_time: new Date(),
    };
    transaction.set(
      reference,
      {
        id,
        actor_id: observation.actorId,
        outcome: observation.outcome,
        differing_fields: [...observation.differingFields].sort(),
        live_context: observation.liveContext,
        materialized_context: observation.materializedContext,
        error_code: observation.errorCode,
        observation_count: existing.exists ? FieldValue.increment(1) : 1,
        first_observed_at: existing.exists
          ? existing.get("first_observed_at")
          : observation.observedAt,
        last_observed_at: observation.observedAt,
        is_deleted: false,
        created_at: existing.exists
          ? existing.get("created_at")
          : observation.observedAt,
        ...timestamps,
      },
      { merge: true },
    );
  });
};
