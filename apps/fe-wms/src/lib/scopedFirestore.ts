import {
  collection,
  onSnapshot,
  query,
  where,
  type DocumentData,
  type FieldPath,
  type Firestore,
  type Query,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type { FacilityPermissionScope } from "@/utils/facilityPermissionScope";

const FIRESTORE_IN_LIMIT = 30;

function chunks<T>(values: readonly T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

export function buildFacilityScopedQueries({
  db,
  collectionName,
  facilityField,
  scope,
  constraints = [],
}: {
  db: Firestore;
  collectionName: string;
  facilityField: string | FieldPath;
  scope: FacilityPermissionScope;
  constraints?: readonly QueryConstraint[];
}): Query<DocumentData>[] {
  const reference = collection(db, collectionName);
  if (scope.isSystemAdmin) return [query(reference, ...constraints)];
  return chunks(scope.facilityIds, FIRESTORE_IN_LIMIT).map((facilityIds) =>
    query(reference, where(facilityField, "in", facilityIds), ...constraints),
  );
}

export function subscribeToMergedQueries<T>({
  queries,
  mapDocument,
  onData,
  onError,
}: {
  queries: readonly Query<DocumentData>[];
  mapDocument: (document: QueryDocumentSnapshot<DocumentData>) => T;
  onData: (records: T[]) => void;
  onError: (error: Error) => void;
}): () => void {
  if (queries.length === 0) {
    onData([]);
    return () => undefined;
  }

  const snapshots = new Map<number, Map<string, T>>();
  const publish = () => {
    const merged = new Map<string, T>();
    snapshots.forEach((records) =>
      records.forEach((record, documentId) => merged.set(documentId, record)),
    );
    onData([...merged.values()]);
  };
  const unsubscribes = queries.map((scopedQuery, queryIndex) =>
    onSnapshot(
      scopedQuery,
      (snapshot) => {
        snapshots.set(
          queryIndex,
          new Map(
            snapshot.docs.map((document) => [
              document.id,
              mapDocument(document),
            ]),
          ),
        );
        publish();
      },
      (error) => onError(error),
    ),
  );
  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
}
