/**
 * Firebase Admin runtime.
 *
 * Production exposes only the default Firebase project. In local development,
 * the request-scoped proxies below can route one request to either configured
 * project without leaking that choice into concurrent requests.
 */

import {
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getMessaging, type Messaging } from "firebase-admin/messaging";
import { getStorage, type Storage } from "firebase-admin/storage";
import {
  getRequestLocalFirebaseTarget,
  isLocalFirebaseTargetSelectionEnabled,
  type LocalFirebaseTarget,
} from "./firebaseTargetContext.js";

interface FirebaseAdminServices {
  db: Firestore;
  auth: Auth;
  storage: Storage;
  messaging: Messaging;
}

function projectIdOf(serviceAccount: ServiceAccount): string {
  const projectId =
    serviceAccount.projectId ??
    (serviceAccount as Record<string, unknown>)["project_id"];
  if (typeof projectId !== "string" || !projectId) {
    throw new Error('Service Account JSON is missing "project_id" field.');
  }
  return projectId;
}

function parseServiceAccount(
  environmentVariable: string,
  required: boolean,
): ServiceAccount | null {
  const base64 = process.env[environmentVariable];
  if (!base64) {
    if (!required) return null;
    throw new Error(
      `[be-wms] FATAL: Missing ${environmentVariable} environment variable.`,
    );
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(base64, "base64").toString("utf-8"),
    ) as ServiceAccount;
    projectIdOf(parsed);
    return parsed;
  } catch (error) {
    throw new Error(
      `[be-wms] FATAL: Failed to parse ${environmentVariable}. ` +
        `Detail: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function initializeAdminApp(
  appName: string,
  serviceAccount: ServiceAccount,
  storageBucket?: string,
): App {
  const existingApp = getApps().find((candidate) => candidate.name === appName);
  if (existingApp) return existingApp;

  const options = {
    credential: cert(serviceAccount),
    storageBucket,
  };
  return appName === "[DEFAULT]"
    ? initializeApp(options)
    : initializeApp(options, appName);
}

function servicesFor(app: App): FirebaseAdminServices {
  return {
    db: getFirestore(app),
    auth: getAuth(app),
    storage: getStorage(app),
    messaging: getMessaging(app),
  };
}

const defaultServiceAccount = parseServiceAccount(
  "FIREBASE_SERVICE_ACCOUNT_BASE64",
  true,
)!;
const defaultApp = initializeAdminApp(
  "[DEFAULT]",
  defaultServiceAccount,
  process.env.FIREBASE_STORAGE_BUCKET ??
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
);
const defaultServices = servicesFor(defaultApp);
const defaultProjectId = projectIdOf(defaultServiceAccount);

export const defaultLocalFirebaseTarget: LocalFirebaseTarget =
  defaultProjectId === "jw-system-f2104" ? "jw-system-f2104" : "test-jw-system";

const localServices = new Map<LocalFirebaseTarget, FirebaseAdminServices>();
localServices.set(defaultLocalFirebaseTarget, defaultServices);

if (isLocalFirebaseTargetSelectionEnabled()) {
  const localConfigurations: Array<{
    target: LocalFirebaseTarget;
    credentialVariable: string;
    storageBucket?: string;
  }> = [
    {
      target: "test-jw-system",
      credentialVariable: "TEST_FIREBASE_SERVICE_ACCOUNT_BASE64",
      storageBucket: process.env.TEST_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    },
    {
      target: "jw-system-f2104",
      credentialVariable: "PROD_FIREBASE_SERVICE_ACCOUNT_BASE64",
      storageBucket: process.env.PROD_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    },
  ];

  for (const configuration of localConfigurations) {
    if (localServices.has(configuration.target)) continue;
    const serviceAccount = parseServiceAccount(
      configuration.credentialVariable,
      false,
    );
    if (!serviceAccount) {
      console.warn(
        `[be-wms] Local Firebase target ${configuration.target} is not configured.`,
      );
      continue;
    }
    const projectId = projectIdOf(serviceAccount);
    if (projectId !== configuration.target) {
      throw new Error(
        `[be-wms] ${configuration.credentialVariable} belongs to ${projectId}, ` +
          `expected ${configuration.target}.`,
      );
    }
    const app = initializeAdminApp(
      `local-${configuration.target}`,
      serviceAccount,
      configuration.storageBucket,
    );
    localServices.set(configuration.target, servicesFor(app));
  }
}

console.info(
  `[be-wms] Firebase Admin initialized. Default project: ${defaultProjectId}`,
);

export function isLocalFirebaseTargetConfigured(
  target: LocalFirebaseTarget,
): boolean {
  return localServices.has(target);
}

function currentServices(): FirebaseAdminServices {
  const target = getRequestLocalFirebaseTarget(defaultLocalFirebaseTarget);
  const services = localServices.get(target);
  if (!services) {
    throw new Error(`[be-wms] Firebase target ${target} is not configured.`);
  }
  return services;
}

function serviceProxy<K extends keyof FirebaseAdminServices>(
  key: K,
): FirebaseAdminServices[K] {
  return new Proxy({} as FirebaseAdminServices[K], {
    get(_target, property) {
      const service = currentServices()[key];
      const value = Reflect.get(service, property, service);
      return typeof value === "function" ? value.bind(service) : value;
    },
  });
}

const db = serviceProxy("db");
const auth = serviceProxy("auth");
const storage = serviceProxy("storage");
const messaging = serviceProxy("messaging");

export { db, auth, storage, messaging };
