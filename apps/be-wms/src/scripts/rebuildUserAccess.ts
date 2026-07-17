import { findPendingUserAccessRebuilds } from "../repositories/userAccessRebuildRequestRepository.js";
import {
  rebuildAllActiveUserAccess,
  rebuildUserAccessForUsers,
  repairPendingUserAccessRebuilds,
} from "../services/userAccessRebuildService.js";

const readArgument = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
};

const projectId = (): string | null => {
  const environmentProject =
    process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || null;
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) return environmentProject;
  const serviceAccount = JSON.parse(
    Buffer.from(encoded, "base64").toString("utf8"),
  ) as { project_id?: string; projectId?: string };
  const accountProject =
    serviceAccount.project_id ?? serviceAccount.projectId ?? null;
  if (
    environmentProject &&
    accountProject &&
    environmentProject !== accountProject
  ) {
    throw new Error("FIREBASE_PROJECT_IDENTITY_MISMATCH");
  }
  return environmentProject || accountProject;
};

const main = async (): Promise<void> => {
  const apply = process.argv.includes("--apply");
  const rebuildAll = process.argv.includes("--all");
  const userId = readArgument("user-id");
  const initiatedBy = readArgument("initiated-by") ?? "dry-run";
  const limit = Number(readArgument("limit") ?? "100");
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) {
    throw new Error("LIMIT_MUST_BE_1_TO_1000");
  }

  const resolvedProject = projectId();
  if (!resolvedProject) throw new Error("FIREBASE_PROJECT_ID_NOT_RESOLVED");
  if (apply && readArgument("confirm-project") !== resolvedProject) {
    throw new Error(`APPLY_REQUIRES_EXACT_CONFIRM_PROJECT:${resolvedProject}`);
  }
  if (apply && !readArgument("initiated-by")) {
    throw new Error("APPLY_REQUIRES_INITIATED_BY");
  }

  if (!apply) {
    const pending = await findPendingUserAccessRebuilds(limit);
    console.log(
      JSON.stringify(
        {
          mode: "DRY_RUN",
          projectId: resolvedProject,
          requestedUserId: userId ?? null,
          rebuildAll,
          pendingCount: pending.length,
          pendingUserIds: pending.map((request) => request.user_id),
        },
        null,
        2,
      ),
    );
    return;
  }

  const result = userId
    ? await rebuildUserAccessForUsers([userId], "MANUAL_REBUILD", initiatedBy)
    : rebuildAll
      ? await rebuildAllActiveUserAccess("FULL_REBUILD", initiatedBy)
      : await repairPendingUserAccessRebuilds(initiatedBy, limit);
  console.log(
    JSON.stringify(
      {
        mode: "APPLY",
        projectId: resolvedProject,
        ...result,
      },
      null,
      2,
    ),
  );
  if (result.failed.length > 0) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
