const PRODUCTION_PROJECT_ID = "jw-system-f2104";
const credential = process.env.PROD_FIREBASE_SERVICE_ACCOUNT_BASE64;

if (!credential) throw new Error("PROD_FIREBASE_SERVICE_ACCOUNT_BASE64_REQUIRED");
const account = JSON.parse(
  Buffer.from(credential, "base64").toString("utf8"),
) as { project_id?: string };
if (account.project_id !== PRODUCTION_PROJECT_ID) {
  throw new Error("PRODUCTION_CREDENTIAL_PROJECT_MISMATCH");
}
if (
  !process.argv.includes("--apply") ||
  !process.argv.includes(`--confirm-production-project=${PRODUCTION_PROJECT_ID}`)
) {
  throw new Error(`CONFIRM_PRODUCTION_PROJECT_REQUIRED:${PRODUCTION_PROJECT_ID}`);
}
if (process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("PRODUCTION_RUNNER_REFUSES_FIRESTORE_EMULATOR");
}

process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = credential;
process.env.GOOGLE_CLOUD_PROJECT = PRODUCTION_PROJECT_ID;
process.env.NODE_ENV = "production";

await import("./rolloutLm81AeonConsolidation.js");
