const DATABASE_NAME = "wms-user-snapshots";
const DATABASE_VERSION = 1;
const STORE_NAME = "snapshots";

interface StoredSnapshot<T> {
  key: string;
  ownerId: string;
  namespace: string;
  savedAt: number;
  expiresAt: number;
  value: T;
}

export interface ClientSnapshot<T> {
  value: T;
  savedAt: number;
}

function snapshotKey(ownerId: string, namespace: string) {
  return `${ownerId}:${namespace}`;
}

function openSnapshotDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, {
          keyPath: "key",
        });
        store.createIndex("ownerId", "ownerId", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    request.onblocked = () => resolve(null);
  });
}

export async function readClientSnapshot<T>(
  ownerId: string,
  namespace: string,
): Promise<ClientSnapshot<T> | null> {
  const database = await openSnapshotDatabase();
  if (!database) return null;

  return new Promise((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const key = snapshotKey(ownerId, namespace);
    const request = store.get(key);

    request.onsuccess = () => {
      const record = request.result as StoredSnapshot<T> | undefined;
      if (
        !record ||
        record.ownerId !== ownerId ||
        record.namespace !== namespace ||
        record.expiresAt <= Date.now()
      ) {
        if (record) store.delete(key);
        resolve(null);
        return;
      }
      resolve({ value: record.value, savedAt: record.savedAt });
    };
    request.onerror = () => resolve(null);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function writeClientSnapshot<T>({
  ownerId,
  namespace,
  value,
  ttlMs,
}: {
  ownerId: string;
  namespace: string;
  value: T;
  ttlMs: number;
}): Promise<void> {
  const database = await openSnapshotDatabase();
  if (!database) return;

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put({
      key: snapshotKey(ownerId, namespace),
      ownerId,
      namespace,
      savedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
      value,
    } satisfies StoredSnapshot<T>);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
  database.close();
}

export async function isolateClientSnapshotsForAccount(
  ownerId: string,
): Promise<void> {
  const database = await openSnapshotDatabase();
  if (!database) return;

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const cursorRequest = transaction.objectStore(STORE_NAME).openCursor();
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      const record = cursor.value as StoredSnapshot<unknown>;
      if (record.ownerId !== ownerId) cursor.delete();
      cursor.continue();
    };
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
  database.close();
}

export async function clearClientSnapshots(): Promise<void> {
  const database = await openSnapshotDatabase();
  if (!database) return;

  await new Promise<void>((resolve) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => resolve();
    transaction.onabort = () => resolve();
  });
  database.close();
}
