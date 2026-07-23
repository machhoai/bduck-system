/**
 * Firebase browser SDK initialization.
 *
 * Firestore intentionally uses memory-only cache. Sensitive snapshots remain
 * available during the current verified offline session, but are never shared
 * with the next account through IndexedDB on a shared device.
 */

import {
  getApps,
  initializeApp,
  type FirebaseApp,
  type FirebaseOptions,
} from "firebase/app";
import { getAuth, signOut as firebaseSignOut, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";
import {
  getSelectedLocalFirebaseTarget,
  installLocalFirebaseTargetFetch,
  isLocalFirebaseTargetSelectorEnabled,
  saveSelectedLocalFirebaseTarget,
  type LocalFirebaseTarget,
} from "./localFirebaseTarget";

const defaultFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const localFirebaseConfigs: Record<LocalFirebaseTarget, FirebaseOptions> = {
  "test-jw-system": {
    apiKey:
      process.env.NEXT_PUBLIC_LOCAL_TEST_FIREBASE_API_KEY ||
      defaultFirebaseConfig.apiKey,
    authDomain:
      process.env.NEXT_PUBLIC_LOCAL_TEST_FIREBASE_AUTH_DOMAIN ||
      defaultFirebaseConfig.authDomain,
    projectId:
      process.env.NEXT_PUBLIC_LOCAL_TEST_FIREBASE_PROJECT_ID ||
      "test-jw-system",
    storageBucket:
      process.env.NEXT_PUBLIC_LOCAL_TEST_FIREBASE_STORAGE_BUCKET ||
      defaultFirebaseConfig.storageBucket,
    messagingSenderId:
      process.env.NEXT_PUBLIC_LOCAL_TEST_FIREBASE_MESSAGING_SENDER_ID ||
      defaultFirebaseConfig.messagingSenderId,
    appId:
      process.env.NEXT_PUBLIC_LOCAL_TEST_FIREBASE_APP_ID ||
      defaultFirebaseConfig.appId,
  },
  "jw-system-f2104": {
    apiKey:
      process.env.NEXT_PUBLIC_LOCAL_PROD_FIREBASE_API_KEY ||
      defaultFirebaseConfig.apiKey,
    authDomain:
      process.env.NEXT_PUBLIC_LOCAL_PROD_FIREBASE_AUTH_DOMAIN ||
      defaultFirebaseConfig.authDomain,
    projectId:
      process.env.NEXT_PUBLIC_LOCAL_PROD_FIREBASE_PROJECT_ID ||
      "jw-system-f2104",
    storageBucket:
      process.env.NEXT_PUBLIC_LOCAL_PROD_FIREBASE_STORAGE_BUCKET ||
      defaultFirebaseConfig.storageBucket,
    messagingSenderId:
      process.env.NEXT_PUBLIC_LOCAL_PROD_FIREBASE_MESSAGING_SENDER_ID ||
      defaultFirebaseConfig.messagingSenderId,
    appId:
      process.env.NEXT_PUBLIC_LOCAL_PROD_FIREBASE_APP_ID ||
      defaultFirebaseConfig.appId,
  },
};

installLocalFirebaseTargetFetch();

const selectedLocalTarget = getSelectedLocalFirebaseTarget();
const firebaseConfig = isLocalFirebaseTargetSelectorEnabled
  ? localFirebaseConfigs[selectedLocalTarget]
  : defaultFirebaseConfig;
const firebaseAppName = isLocalFirebaseTargetSelectorEnabled
  ? `bduck-${selectedLocalTarget}`
  : "[DEFAULT]";

const app: FirebaseApp =
  getApps().find((candidate) => candidate.name === firebaseAppName) ??
  (firebaseAppName === "[DEFAULT]"
    ? initializeApp(firebaseConfig)
    : initializeApp(firebaseConfig, firebaseAppName));

let db: Firestore;
try {
  db = initializeFirestore(app, { localCache: memoryLocalCache() });
} catch (error) {
  console.warn(
    "[fe-wms] Firestore was initialized before memory cache setup; using the existing instance.",
    error,
  );
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getFirestore } = require("firebase/firestore");
  db = getFirestore(app);
}

const auth: Auth = getAuth(app);
const storage: FirebaseStorage = getStorage(app);

export async function switchLocalFirebaseTarget(
  target: LocalFirebaseTarget,
): Promise<void> {
  if (
    !isLocalFirebaseTargetSelectorEnabled ||
    typeof window === "undefined" ||
    target === selectedLocalTarget
  ) {
    return;
  }
  if (auth.currentUser) {
    throw new Error("LOCAL_FIREBASE_TARGET_REQUIRES_SIGN_OUT");
  }

  const targetAppName = `bduck-${target}`;
  const targetApp =
    getApps().find((candidate) => candidate.name === targetAppName) ??
    initializeApp(localFirebaseConfigs[target], targetAppName);
  const targetAuth = getAuth(targetApp);
  await targetAuth.authStateReady();
  await firebaseSignOut(targetAuth);
  saveSelectedLocalFirebaseTarget(target);
  window.location.reload();
}

export { app, db, auth, storage };
