import {
  EmployeeEmploymentStatus,
  EmployeeProfileStatus,
  UserStatus,
  type EmployeeProfile,
} from "@bduck/shared-types";

import {
  auth,
  db,
  getCurrentFirebaseProjectId,
} from "../config/firebase.js";
import { reconcileEmployeeOffboardingProjection } from "../repositories/employeeOffboardingRepository.js";
import { getVietnamLocalDate } from "../services/employeeEmploymentPolicy.js";
import { processEmployeeIdentitySyncJob } from "../services/employeeIdentitySyncService.js";

const APPLY = process.argv.includes("--apply");
const ACTOR_ID = "system:employee-offboarding-reconciliation";

const readArgument = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
};

interface ReconciliationFinding {
  employee_profile_id: string;
  employee_code: string;
  employee_user_id: string | null;
  resignation_date: string | null;
  issues: string[];
  repaired: boolean;
  identity_sync_result: string | null;
}

const isAuthAccountEnabled = async (
  userId: string,
): Promise<boolean | null> => {
  try {
    return !(await auth.getUser(userId)).disabled;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: unknown }).code === "auth/user-not-found"
    ) {
      return null;
    }
    throw error;
  }
};

const inspectProfile = async (
  profile: EmployeeProfile,
): Promise<{ issues: string[]; authAccountEnabled: boolean | null }> => {
  const issues: string[] = [];
  if (profile.status !== EmployeeProfileStatus.INACTIVE) {
    issues.push("PROFILE_ACTIVE");
  }
  if (!profile.user_id) {
    issues.push("MISSING_LINKED_USER_ID");
    return { issues, authAccountEnabled: null };
  }

  const userRef = db.collection("users").doc(profile.user_id);
  const accessRef = db.collection("user_access").doc(profile.user_id);
  const assignmentsQuery = db
    .collection("user_warehouse_roles")
    .where("user_id", "==", profile.user_id);
  const [
    userSnapshot,
    accessSnapshot,
    assignmentsSnapshot,
    authAccountEnabled,
  ] = await Promise.all([
    userRef.get(),
    accessRef.get(),
    assignmentsQuery.get(),
    isAuthAccountEnabled(profile.user_id),
  ]);

  if (!userSnapshot.exists) {
    issues.push("MISSING_USER_DOCUMENT");
  } else {
    const user = userSnapshot.data();
    if (user?.status !== UserStatus.INACTIVE) issues.push("USER_ACTIVE");
    if (user?.status_reason !== "EMPLOYMENT_RESIGNED") {
      issues.push("USER_REASON_NOT_LINKED_TO_RESIGNATION");
    }
    if (user?.status_effective_date !== profile.resignation_date) {
      issues.push("USER_EFFECTIVE_DATE_MISMATCH");
    }
  }
  if (
    assignmentsSnapshot.docs.some(
      (snapshot) => snapshot.data().is_active === true,
    )
  ) {
    issues.push("ACTIVE_ROLE_ASSIGNMENTS");
  }
  if (accessSnapshot.exists && accessSnapshot.data()?.is_deleted !== true) {
    issues.push("ACTIVE_MATERIALIZED_ACCESS");
  }
  if (authAccountEnabled === true) issues.push("FIREBASE_AUTH_ENABLED");
  if (authAccountEnabled === null) issues.push("MISSING_FIREBASE_AUTH_ACCOUNT");

  return { issues, authAccountEnabled };
};

const main = async () => {
  const project = getCurrentFirebaseProjectId();
  const confirmedProject = readArgument("confirm-project");
  if (confirmedProject && confirmedProject !== project) {
    throw new Error(
      `CONFIRMED_PROJECT_MISMATCH:expected=${confirmedProject}:actual=${project}`,
    );
  }
  if (APPLY && confirmedProject !== project) {
    throw new Error(`CONFIRM_PROJECT_REQUIRED:${project}`);
  }
  const today = getVietnamLocalDate();
  const snapshot = await db
    .collection("employee_profiles")
    .where("employment_status", "==", EmployeeEmploymentStatus.RESIGNED)
    .get();
  const profiles = snapshot.docs
    .map((document) => ({
      id: document.id,
      ...(document.data() as Omit<EmployeeProfile, "id">),
    }))
    .filter(
      (profile) =>
        !profile.is_deleted &&
        Boolean(profile.resignation_date) &&
        profile.resignation_date! <= today,
    );

  const findings: ReconciliationFinding[] = [];
  for (const profile of profiles) {
    const inspection = await inspectProfile(profile);
    if (inspection.issues.length === 0) continue;

    const finding: ReconciliationFinding = {
      employee_profile_id: profile.id,
      employee_code: profile.employee_code,
      employee_user_id: profile.user_id,
      resignation_date: profile.resignation_date ?? null,
      issues: inspection.issues,
      repaired: false,
      identity_sync_result: null,
    };
    if (APPLY && profile.user_id && profile.resignation_date) {
      const result = await reconcileEmployeeOffboardingProjection({
        employeeProfileId: profile.id,
        effectiveDate: profile.resignation_date,
        actorId: ACTOR_ID,
        forceIdentitySync: inspection.authAccountEnabled !== false,
      });
      finding.repaired = result.changed;
      if (result.identitySyncJobId) {
        finding.identity_sync_result = await processEmployeeIdentitySyncJob(
          result.identitySyncJobId,
        );
      }
    }
    findings.push(finding);
  }

  console.info(
    JSON.stringify(
      {
        project,
        mode: APPLY ? "apply" : "dry-run",
        date: today,
        resigned_profiles_scanned: profiles.length,
        inconsistent_profiles: findings.length,
        repaired_profiles: findings.filter((finding) => finding.repaired)
          .length,
        findings,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error("[reconcileEmployeeOffboarding] failed", error);
  process.exitCode = 1;
});
