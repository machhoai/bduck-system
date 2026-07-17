import {
  AUTHORIZATION_ROLLOUT_MODES,
  type AuthorizationRolloutMode,
  type AuthorizationShadowOutcome,
} from "@bduck/shared-types";
import type { AuthorizationShadowObservation } from "../repositories/authorizationShadowDiffRepository.js";
import {
  authorizationError,
  type AccessContext,
} from "./authorization/index.js";
import {
  compareAccessContexts,
  summarizeAccessContext,
} from "./authorizationContextComparison.js";

export interface AuthorizationRolloutDependencies {
  loadMaterialized: (actorId: string) => Promise<AccessContext | null>;
  recordObservation: (
    observation: AuthorizationShadowObservation,
  ) => Promise<void>;
}

const defaultDependencies: AuthorizationRolloutDependencies = {
  loadMaterialized: async (actorId) => {
    const { loadMaterializedAccessContext } =
      await import("./materializedAccessContextService.js");
    return loadMaterializedAccessContext(actorId);
  },
  recordObservation: async (observation) => {
    const { recordAuthorizationShadowObservation } =
      await import("../repositories/authorizationShadowDiffRepository.js");
    return recordAuthorizationShadowObservation(observation);
  },
};

export const getAuthorizationRolloutMode = (
  value = process.env.FACILITY_AUTHORIZATION_MODE,
): AuthorizationRolloutMode => {
  const normalized = (value ?? "MATERIALIZED").trim().toUpperCase();
  if (
    !AUTHORIZATION_ROLLOUT_MODES.includes(
      normalized as AuthorizationRolloutMode,
    )
  ) {
    throw new Error("FACILITY_AUTHORIZATION_MODE_INVALID");
  }
  return normalized as AuthorizationRolloutMode;
};

const errorCode = (error: unknown): string =>
  error instanceof Error ? error.message.slice(0, 200) : "UNKNOWN_ERROR";

const safelyRecord = async (
  dependencies: AuthorizationRolloutDependencies,
  observation: AuthorizationShadowObservation,
): Promise<void> => {
  try {
    await dependencies.recordObservation(observation);
  } catch (error) {
    console.error("[authorization-shadow] failed to record observation", error);
  }
};

const observeShadow = async (
  actorId: string,
  liveContext: AccessContext,
  dependencies: AuthorizationRolloutDependencies,
): Promise<void> => {
  const observedAt = new Date();
  try {
    const materialized = await dependencies.loadMaterialized(actorId);
    if (!materialized) {
      await safelyRecord(dependencies, {
        actorId,
        outcome: "MATERIALIZED_MISSING",
        differingFields: ["materialized_context"],
        liveContext: summarizeAccessContext(liveContext),
        materializedContext: null,
        errorCode: null,
        observedAt,
      });
      return;
    }
    const comparison = compareAccessContexts(liveContext, materialized);
    if (comparison.matches) return;
    await safelyRecord(dependencies, {
      actorId,
      outcome: "MISMATCH",
      differingFields: comparison.differingFields,
      liveContext: comparison.live,
      materializedContext: comparison.materialized,
      errorCode: null,
      observedAt,
    });
  } catch (error) {
    const outcome: AuthorizationShadowOutcome = "MATERIALIZED_INVALID";
    await safelyRecord(dependencies, {
      actorId,
      outcome,
      differingFields: ["materialized_context"],
      liveContext: summarizeAccessContext(liveContext),
      materializedContext: null,
      errorCode: errorCode(error),
      observedAt,
    });
  }
};

export const resolveAuthorizationContext = async (
  actorId: string,
  liveContext: AccessContext | null,
  mode = getAuthorizationRolloutMode(),
  dependencies: AuthorizationRolloutDependencies = defaultDependencies,
): Promise<AccessContext> => {
  if (mode === "SHADOW") {
    if (!liveContext) throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
    await observeShadow(actorId, liveContext, dependencies);
    return liveContext;
  }
  try {
    const materialized = await dependencies.loadMaterialized(actorId);
    if (!materialized) throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
    return materialized;
  } catch (error) {
    if (error instanceof Error && error.name === "AuthorizationError")
      throw error;
    console.error("[authorization-cutover] invalid materialized context", {
      actorId,
      error: errorCode(error),
    });
    throw authorizationError("AUTHORIZATION_SOURCE_INVALID");
  }
};
