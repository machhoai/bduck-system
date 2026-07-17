import type { ReceivingItem } from "@/stores/useReceivingStore";

const DATABASE_NAME = "wms_receiving_drafts";
const STORE_NAME = "drafts";
const DATABASE_VERSION = 2;

export function createReceivingDraftId(ownerUserId: string, voucherId: string) {
  return `${ownerUserId}:${voucherId}`;
}

function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (database.objectStoreNames.contains(STORE_NAME)) {
        database.deleteObjectStore(STORE_NAME);
      }
      database.createObjectStore(STORE_NAME, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function prepareReceivingDraftStorage() {
  if (typeof indexedDB === "undefined") return;
  const database = await openDraftDatabase();
  database.close();
}

export async function saveReceivingDraft(
  ownerUserId: string,
  voucherId: string,
  items: ReceivingItem[],
) {
  const database = await openDraftDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction.objectStore(STORE_NAME).put({
    id: createReceivingDraftId(ownerUserId, voucherId),
    ownerUserId,
    voucherId,
    items,
    savedAt: new Date().toISOString(),
  });
  transaction.oncomplete = () => database.close();
  transaction.onerror = () => database.close();
}

export async function loadReceivingDraft(
  ownerUserId: string,
  voucherId: string,
): Promise<ReceivingItem[] | null> {
  const database = await openDraftDatabase();
  return new Promise((resolve) => {
    const request = database
      .transaction(STORE_NAME, "readonly")
      .objectStore(STORE_NAME)
      .get(createReceivingDraftId(ownerUserId, voucherId));
    request.onsuccess = () => {
      database.close();
      const record = request.result;
      resolve(record?.ownerUserId === ownerUserId ? record.items : null);
    };
    request.onerror = () => {
      database.close();
      resolve(null);
    };
  });
}

export async function deleteReceivingDraft(
  ownerUserId: string,
  voucherId: string,
) {
  const database = await openDraftDatabase();
  const transaction = database.transaction(STORE_NAME, "readwrite");
  transaction
    .objectStore(STORE_NAME)
    .delete(createReceivingDraftId(ownerUserId, voucherId));
  transaction.oncomplete = () => database.close();
  transaction.onerror = () => database.close();
}
