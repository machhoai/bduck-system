export const readScriptArgument = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv
    .find((argument) => argument.startsWith(prefix))
    ?.slice(prefix.length);
};

export const resolveScriptFirebaseProjectId = (): string | null => {
  const configured =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    null;
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!encoded) return configured;
  const serviceAccount = JSON.parse(
    Buffer.from(encoded, "base64").toString("utf8"),
  ) as { project_id?: string; projectId?: string };
  const accountProject =
    serviceAccount.project_id ?? serviceAccount.projectId ?? null;
  if (configured && accountProject && configured !== accountProject) {
    throw new Error("FIREBASE_PROJECT_IDENTITY_MISMATCH");
  }
  return configured || accountProject;
};

export const assertConfirmedApply = (): {
  apply: boolean;
  projectId: string;
  initiatedBy: string;
} => {
  const apply = process.argv.includes("--apply");
  const projectId = resolveScriptFirebaseProjectId();
  if (!projectId) throw new Error("FIREBASE_PROJECT_ID_NOT_RESOLVED");
  const initiatedBy = readScriptArgument("initiated-by") ?? "dry-run";
  if (apply && readScriptArgument("confirm-project") !== projectId) {
    throw new Error(`APPLY_REQUIRES_EXACT_CONFIRM_PROJECT:${projectId}`);
  }
  if (apply && !readScriptArgument("initiated-by")) {
    throw new Error("APPLY_REQUIRES_INITIATED_BY");
  }
  return { apply, projectId, initiatedBy };
};
