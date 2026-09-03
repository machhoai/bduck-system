import {
  cert,
  deleteApp,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getStorage, type Storage } from "firebase-admin/storage";

interface MigrationFirebaseClient {
  app: App;
  db: Firestore;
  storage: Storage;
  projectId: string;
  bucketName: string | null;
}

export interface MigrationFirebaseClients {
  source: MigrationFirebaseClient;
  target: MigrationFirebaseClient | null;
  close: () => Promise<void>;
}

const projectIdOf = (account: ServiceAccount): string => {
  const value =
    account.projectId ?? (account as Record<string, unknown>).project_id;
  if (typeof value !== "string" || !value)
    throw new Error("SERVICE_ACCOUNT_PROJECT_MISSING");
  return value;
};

const decodeAccount = (encoded: string): ServiceAccount => {
  try {
    return JSON.parse(
      Buffer.from(encoded, "base64").toString("utf8"),
    ) as ServiceAccount;
  } catch {
    throw new Error("SERVICE_ACCOUNT_BASE64_INVALID");
  }
};

const sourceAccount = (): ServiceAccount => {
  const encoded = process.env.MARKETING_VOUCHER_SOURCE_SERVICE_ACCOUNT_BASE64;
  if (encoded) return decodeAccount(encoded);
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(
    /\\n/gu,
    "\n",
  );
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("SOURCE_FIREBASE_CREDENTIALS_MISSING");
  }
  return { projectId, clientEmail, privateKey };
};

const accountFromParts = (prefix: "TEST" | "PROD"): ServiceAccount | null => {
  const projectId = process.env[`${prefix}_FIREBASE_PROJECT_ID`];
  const clientEmail = process.env[`${prefix}_FIREBASE_CLIENT_EMAIL`];
  const privateKey = process.env[`${prefix}_FIREBASE_PRIVATE_KEY`]?.replace(
    /\\n/gu,
    "\n",
  );
  return projectId && clientEmail && privateKey
    ? { projectId, clientEmail, privateKey }
    : null;
};

const targetAccount = (expectedProjectId: string | null): ServiceAccount => {
  const explicit = process.env.MARKETING_VOUCHER_TARGET_SERVICE_ACCOUNT_BASE64;
  if (explicit) return decodeAccount(explicit);
  const prefix = expectedProjectId === "jw-system-f2104" ? "PROD" : "TEST";
  const parts = accountFromParts(prefix);
  if (parts) return parts;
  const encoded = process.env[`${prefix}_FIREBASE_SERVICE_ACCOUNT_BASE64`];
  if (encoded) return decodeAccount(encoded);
  const fallback = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  if (fallback) return decodeAccount(fallback);
  throw new Error("TARGET_FIREBASE_CREDENTIALS_MISSING");
};

const createClient = (
  name: string,
  account: ServiceAccount,
  bucketName: string | undefined,
): MigrationFirebaseClient => {
  const projectId = projectIdOf(account);
  const app = initializeApp(
    {
      credential: cert(account),
      projectId,
      storageBucket: bucketName,
    },
    name,
  );
  return {
    app,
    db: getFirestore(app),
    storage: getStorage(app),
    projectId,
    bucketName: bucketName ?? null,
  };
};

export const createMarketingVoucherMigrationClients = (
  needsTarget: boolean,
  expectedTargetProjectId: string | null,
): MigrationFirebaseClients => {
  const source = createClient(
    `voucher-migration-source-${Date.now()}`,
    sourceAccount(),
    process.env.MARKETING_VOUCHER_SOURCE_STORAGE_BUCKET,
  );
  const target = needsTarget
    ? createClient(
        `voucher-migration-target-${Date.now()}`,
        targetAccount(expectedTargetProjectId),
        process.env.MARKETING_VOUCHER_TARGET_STORAGE_BUCKET ??
          process.env.TEST_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      )
    : null;
  return {
    source,
    target,
    close: async () => {
      await Promise.all([
        deleteApp(source.app),
        target ? deleteApp(target.app) : Promise.resolve(),
      ]);
    },
  };
};
