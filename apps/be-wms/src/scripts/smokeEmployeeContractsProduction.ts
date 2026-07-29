import type { AccessContext } from "../services/authorization/index.js";
import { auth, db } from "../config/firebase.js";
import { loadMaterializedAccessContext } from "../services/materializedAccessContextService.js";

const API_BASE_URL = "https://api-erp.joyworldcityfuns.vn";
const CONTRACT_READ = "employees.contracts.read";
const CONTRACT_SELF_READ = "employees.contracts.self.read";

interface ProfileRecord {
  id: string;
  user_id: string | null;
  workplace_warehouse_id: string | null;
  is_deleted: boolean;
}

interface Actor {
  userId: string;
  context: AccessContext;
}

const hasPermission = (
  context: AccessContext,
  permission: string,
  facilityId: string,
) =>
  context.isSystemAdmin ||
  context.grants[facilityId]?.permissions["*"] === true ||
  context.grants[facilityId]?.permissions[permission] === true;

const exchangeCustomToken = async (userId: string): Promise<string> => {
  const apiKey = process.env.PROD_NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) throw new Error("PROD_FIREBASE_API_KEY_REQUIRED");
  const customToken = await auth.createCustomToken(userId);
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    },
  );
  const body = (await response.json()) as {
    idToken?: string;
    error?: { message?: string };
  };
  if (!response.ok || !body.idToken) {
    throw new Error(`CUSTOM_TOKEN_EXCHANGE_FAILED:${body.error?.message ?? response.status}`);
  }
  return body.idToken;
};

const requestStatus = async (path: string, idToken: string) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { authorization: `Bearer ${idToken}` },
  });
  return response.status;
};

const loadActors = async (): Promise<Actor[]> => {
  const snapshot = await db
    .collection("user_access")
    .where("is_deleted", "==", false)
    .get();
  const actors: Actor[] = [];
  for (const document of snapshot.docs) {
    try {
      const context = await loadMaterializedAccessContext(document.id);
      if (context) actors.push({ userId: document.id, context });
    } catch {
      // A malformed or stale snapshot is intentionally not a smoke candidate.
    }
  }
  return actors;
};

const loadProfiles = async (): Promise<ProfileRecord[]> => {
  const snapshot = await db
    .collection("employee_profiles")
    .where("is_deleted", "==", false)
    .get();
  return snapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      user_id: typeof data.user_id === "string" ? data.user_id : null,
      workplace_warehouse_id:
        typeof data.workplace_warehouse_id === "string"
          ? data.workplace_warehouse_id
          : null,
      is_deleted: false,
    };
  });
};

const main = async () => {
  const [actors, profiles] = await Promise.all([
    loadActors(),
    loadProfiles(),
  ]);
  const results: Array<Record<string, unknown>> = [];
  const tokenCache = new Map<string, string>();
  const tokenFor = async (userId: string) => {
    const cached = tokenCache.get(userId);
    if (cached) return cached;
    const token = await exchangeCustomToken(userId);
    tokenCache.set(userId, token);
    return token;
  };

  const administrator = actors.find((actor) => actor.context.isSystemAdmin);
  if (administrator) {
    const status = await requestStatus(
      "/api/employee-contracts/expiring",
      await tokenFor(administrator.userId),
    );
    results.push({ scenario: "SYSTEM_ADMIN_LIST_EXPIRING", status });
  } else {
    results.push({ scenario: "SYSTEM_ADMIN_LIST_EXPIRING", status: "MISSING_ACTOR" });
  }

  const managerScenario = actors
    .filter((actor) => !actor.context.isSystemAdmin)
    .flatMap((actor) =>
      profiles.map((profile) => ({ actor, profile })),
    )
    .find(
      ({ actor, profile }) =>
        Boolean(profile.workplace_warehouse_id) &&
        hasPermission(
          actor.context,
          CONTRACT_READ,
          profile.workplace_warehouse_id!,
        ),
    );
  if (managerScenario) {
    const token = await tokenFor(managerScenario.actor.userId);
    const allowedStatus = await requestStatus(
      `/api/employee-profiles/${managerScenario.profile.id}/contracts`,
      token,
    );
    const deniedProfile = profiles.find(
      (profile) =>
        Boolean(profile.workplace_warehouse_id) &&
        !hasPermission(
          managerScenario.actor.context,
          CONTRACT_READ,
          profile.workplace_warehouse_id!,
        ),
    );
    const deniedStatus = deniedProfile
      ? await requestStatus(
          `/api/employee-profiles/${deniedProfile.id}/contracts`,
          token,
        )
      : "NO_OUT_OF_SCOPE_PROFILE";
    results.push({
      scenario: "FACILITY_HR_READ",
      facility_id: managerScenario.profile.workplace_warehouse_id,
      allowed_status: allowedStatus,
      denied_status: deniedStatus,
    });
  } else {
    results.push({ scenario: "FACILITY_HR_READ", status: "MISSING_ACTOR" });
  }

  const selfScenario = profiles
    .filter(
      (profile): profile is ProfileRecord & {
        user_id: string;
        workplace_warehouse_id: string;
      } => Boolean(profile.user_id && profile.workplace_warehouse_id),
    )
    .map((profile) => ({
      profile,
      actor: actors.find((item) => item.userId === profile.user_id),
    }))
    .find(
      ({ actor, profile }) =>
        Boolean(
          actor &&
            !actor.context.isSystemAdmin &&
            hasPermission(
              actor.context,
              CONTRACT_SELF_READ,
              profile.workplace_warehouse_id,
            ) &&
            !hasPermission(
              actor.context,
              CONTRACT_READ,
              profile.workplace_warehouse_id,
            ),
        ),
    );
  if (selfScenario?.actor) {
    const token = await tokenFor(selfScenario.actor.userId);
    const ownStatus = await requestStatus(
      `/api/employee-profiles/${selfScenario.profile.id}/contracts`,
      token,
    );
    const otherProfile = profiles.find(
      (profile) =>
        profile.id !== selfScenario.profile.id &&
        profile.workplace_warehouse_id ===
          selfScenario.profile.workplace_warehouse_id,
    );
    const otherStatus = otherProfile
      ? await requestStatus(
          `/api/employee-profiles/${otherProfile.id}/contracts`,
          token,
        )
      : "NO_PEER_PROFILE";
    results.push({
      scenario: "EMPLOYEE_SELF_READ",
      facility_id: selfScenario.profile.workplace_warehouse_id,
      own_status: ownStatus,
      other_employee_status: otherStatus,
    });
  } else {
    results.push({ scenario: "EMPLOYEE_SELF_READ", status: "MISSING_ACTOR" });
  }

  console.log(JSON.stringify({ actors: actors.length, profiles: profiles.length, results }, null, 2));
  const failed = results.some((result) => {
    if (result.status === "MISSING_ACTOR") return true;
    if (result.scenario === "SYSTEM_ADMIN_LIST_EXPIRING") return result.status !== 200;
    if (result.scenario === "FACILITY_HR_READ") {
      return (
        result.allowed_status !== 200 ||
        (typeof result.denied_status === "number" && result.denied_status !== 403)
      );
    }
    return (
      result.own_status !== 200 ||
      (typeof result.other_employee_status === "number" &&
        result.other_employee_status !== 403)
    );
  });
  if (failed) process.exitCode = 2;
};

main().catch((error) => {
  console.error(
    "[smokeEmployeeContractsProduction]",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
