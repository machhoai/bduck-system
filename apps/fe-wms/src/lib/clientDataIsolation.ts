import { prepareReceivingDraftStorage } from "@/lib/receivingDraftStorage";
import { useReceivingStore } from "@/stores/useReceivingStore";

const ACTIVE_ACCOUNT_KEY = "wms-active-account";
const LEGACY_AUTH_STORAGE_KEY = "wms-auth-storage";

function deleteIndexedDatabase(name: string) {
  return new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  });
}

async function purgeLegacySharedFirestoreCache() {
  if (
    typeof indexedDB === "undefined" ||
    typeof indexedDB.databases !== "function"
  ) {
    return;
  }
  const databases = await indexedDB.databases();
  const names = databases
    .map((database) => database.name)
    .filter((name): name is string => Boolean(name?.startsWith("firestore/")));
  await Promise.all(names.map(deleteIndexedDatabase));
}

/**
 * Removes legacy shared cache and detaches account-owned in-memory drafts.
 * Version 2 receiving drafts remain offline-capable under a user-prefixed key.
 */
export async function isolateClientDataForAccount(userId: string | null) {
  if (typeof window === "undefined") return;
  const nextUserId = userId ?? "";
  let previousUserId: string | null = null;
  try {
    previousUserId = window.sessionStorage.getItem(ACTIVE_ACCOUNT_KEY);
    window.localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
  } catch (error) {
    console.warn("[clientDataIsolation] browser storage is unavailable:", error);
  }

  if (previousUserId !== nextUserId) {
    useReceivingStore.getState().clearSessionMemory();
  }
  try {
    if (nextUserId) {
      window.sessionStorage.setItem(ACTIVE_ACCOUNT_KEY, nextUserId);
    } else {
      window.sessionStorage.removeItem(ACTIVE_ACCOUNT_KEY);
    }
  } catch (error) {
    console.warn("[clientDataIsolation] account marker is unavailable:", error);
  }

  await Promise.allSettled([
    prepareReceivingDraftStorage(),
    purgeLegacySharedFirestoreCache(),
  ]);
}
