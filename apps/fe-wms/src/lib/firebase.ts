/**
 * Firebase browser SDK initialization.
 *
 * Firestore intentionally uses memory-only cache. Sensitive snapshots remain
 * available during the current verified offline session, but are never shared
 * with the next account through IndexedDB on a shared device.
 */

import { getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  memoryLocalCache,
  type Firestore,
} from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app: FirebaseApp =
  getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);

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

export { app, db, auth, storage };
