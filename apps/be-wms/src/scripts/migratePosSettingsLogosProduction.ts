const PRODUCTION_PROJECT_ID = "jw-system-f2104";

const decodeProjectId = (encoded: string): string | null => {
  const credential = JSON.parse(
    Buffer.from(encoded, "base64").toString("utf8"),
  ) as { project_id?: string; projectId?: string };
  return credential.project_id ?? credential.projectId ?? null;
};

const main = async () => {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("PRODUCTION_RUNNER_REFUSES_FIRESTORE_EMULATOR");
  }
  const credential = process.env.PROD_FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (!credential) throw new Error("PROD_FIREBASE_SERVICE_ACCOUNT_BASE64_REQUIRED");
  if (decodeProjectId(credential) !== PRODUCTION_PROJECT_ID) {
    throw new Error("PRODUCTION_CREDENTIAL_PROJECT_MISMATCH");
  }
  if (!process.argv.includes(`--confirm-production-project=${PRODUCTION_PROJECT_ID}`)) {
    throw new Error(`CONFIRM_PRODUCTION_PROJECT_REQUIRED:${PRODUCTION_PROJECT_ID}`);
  }
  process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = credential;
  process.env.FIREBASE_PROJECT_ID = PRODUCTION_PROJECT_ID;
  process.env.GOOGLE_CLOUD_PROJECT = PRODUCTION_PROJECT_ID;
  process.env.NODE_ENV = "production";
  process.env.FIREBASE_STORAGE_BUCKET =
    process.env.PROD_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ??
    `${PRODUCTION_PROJECT_ID}.firebasestorage.app`;
  await import("./migratePosSettingsLogos.js");
};

main().catch((error) => {
  console.error(
    "[migratePosSettingsLogosProduction]",
    error instanceof Error ? error.message : error,
  );
  process.exitCode = 1;
});
