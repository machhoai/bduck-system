import {
  OFFICE_SCOPE_CONFIGS_COLLECTION,
  OFFICE_SCOPE_EDGES_COLLECTION,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import type { AuthorizationSourceSnapshot } from "../services/authorization/authorizationTypes.js";
import {
  loadAuthorizationRequestSourceFromReader,
  type AuthorizationRequestSource,
  type AuthorizationSourceReader,
} from "./authorizationSourceLoader.js";
import type { AuthorizationSourceDocument } from "./authorizationSourceMapper.js";

const USERS_COLLECTION = "users";
const PROFILES_COLLECTION = "employee_profiles";
const ASSIGNMENTS_COLLECTION = "user_warehouse_roles";
const ROLES_COLLECTION = "roles";
const FACILITIES_COLLECTION = "warehouses";
const BATCH_GET_SIZE = 100;

const toSourceDocument = (
  snapshot: FirebaseFirestore.DocumentSnapshot,
): AuthorizationSourceDocument | null =>
  snapshot.exists ? { id: snapshot.id, data: snapshot.data() ?? {} } : null;

const queryDocuments = async (
  query: FirebaseFirestore.Query,
): Promise<AuthorizationSourceDocument[]> => {
  const snapshot = await query.get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    data: document.data(),
  }));
};

const getDocumentsByIds = async (
  collectionName: string,
  documentIds: readonly string[],
): Promise<AuthorizationSourceDocument[]> => {
  const ids = Array.from(new Set(documentIds));
  if (ids.length === 0) return [];

  const chunks: string[][] = [];
  for (let index = 0; index < ids.length; index += BATCH_GET_SIZE) {
    chunks.push(ids.slice(index, index + BATCH_GET_SIZE));
  }
  const snapshots = await Promise.all(
    chunks.map(async (chunk) => {
      const references = chunk.map((id) =>
        db.collection(collectionName).doc(id),
      );
      const [first, ...rest] = references;
      return db.getAll(first, ...rest);
    }),
  );
  return snapshots
    .flat()
    .map(toSourceDocument)
    .filter((document): document is AuthorizationSourceDocument =>
      Boolean(document),
    );
};

const firestoreAuthorizationSourceReader: AuthorizationSourceReader = {
  async getUser(actorId) {
    return toSourceDocument(
      await db.collection(USERS_COLLECTION).doc(actorId).get(),
    );
  },

  findProfiles: (actorId) =>
    queryDocuments(
      db.collection(PROFILES_COLLECTION).where("user_id", "==", actorId),
    ),

  findAssignments: (actorId) =>
    queryDocuments(
      db.collection(ASSIGNMENTS_COLLECTION).where("user_id", "==", actorId),
    ),

  getRoles: (roleIds) => getDocumentsByIds(ROLES_COLLECTION, roleIds),

  getFacilities: (facilityIds) =>
    getDocumentsByIds(FACILITIES_COLLECTION, facilityIds),

  findAllFacilityCandidates: () =>
    queryDocuments(
      db.collection(FACILITIES_COLLECTION).where("is_deleted", "==", false),
    ),

  async getOfficeConfig(officeId) {
    return toSourceDocument(
      await db.collection(OFFICE_SCOPE_CONFIGS_COLLECTION).doc(officeId).get(),
    );
  },

  findOfficeEdges: (officeId) =>
    queryDocuments(
      db
        .collection(OFFICE_SCOPE_EDGES_COLLECTION)
        .where("office_id", "==", officeId),
    ),
};

const createTransactionAuthorizationSourceReader = (
  transaction: FirebaseFirestore.Transaction,
): AuthorizationSourceReader => {
  const getTransactionDocumentsByIds = async (
    collectionName: string,
    documentIds: readonly string[],
  ): Promise<AuthorizationSourceDocument[]> => {
    const ids = Array.from(new Set(documentIds));
    if (ids.length === 0) return [];
    const documents: AuthorizationSourceDocument[] = [];
    for (let index = 0; index < ids.length; index += BATCH_GET_SIZE) {
      const refs = ids
        .slice(index, index + BATCH_GET_SIZE)
        .map((id) => db.collection(collectionName).doc(id));
      const snapshots = await transaction.getAll(...refs);
      snapshots
        .map(toSourceDocument)
        .filter((document): document is AuthorizationSourceDocument =>
          Boolean(document),
        )
        .forEach((document) => documents.push(document));
    }
    return documents;
  };
  const queryTransactionDocuments = async (
    query: FirebaseFirestore.Query,
  ): Promise<AuthorizationSourceDocument[]> => {
    const snapshot = await transaction.get(query);
    return snapshot.docs.map((document) => ({
      id: document.id,
      data: document.data(),
    }));
  };

  return {
    async getUser(actorId) {
      return toSourceDocument(
        await transaction.get(db.collection(USERS_COLLECTION).doc(actorId)),
      );
    },
    findProfiles: (actorId) =>
      queryTransactionDocuments(
        db.collection(PROFILES_COLLECTION).where("user_id", "==", actorId),
      ),
    findAssignments: (actorId) =>
      queryTransactionDocuments(
        db.collection(ASSIGNMENTS_COLLECTION).where("user_id", "==", actorId),
      ),
    getRoles: (roleIds) =>
      getTransactionDocumentsByIds(ROLES_COLLECTION, roleIds),
    getFacilities: (facilityIds) =>
      getTransactionDocumentsByIds(FACILITIES_COLLECTION, facilityIds),
    findAllFacilityCandidates: () =>
      queryTransactionDocuments(
        db.collection(FACILITIES_COLLECTION).where("is_deleted", "==", false),
      ),
    async getOfficeConfig(officeId) {
      return toSourceDocument(
        await transaction.get(
          db.collection(OFFICE_SCOPE_CONFIGS_COLLECTION).doc(officeId),
        ),
      );
    },
    findOfficeEdges: (officeId) =>
      queryTransactionDocuments(
        db
          .collection(OFFICE_SCOPE_EDGES_COLLECTION)
          .where("office_id", "==", officeId),
      ),
  };
};

export const loadAuthorizationRequestSource = (
  actorId: string,
  now = new Date(),
): Promise<AuthorizationRequestSource> =>
  loadAuthorizationRequestSourceFromReader(
    firestoreAuthorizationSourceReader,
    actorId,
    now,
  );

/**
 * Loads the bounded raw inputs consumed by buildAccessContext. Firestore
 * failures propagate; invalid identity data returns an actor-null snapshot.
 */
export const loadAuthorizationSourceSnapshot = async (
  actorId: string,
  now = new Date(),
): Promise<AuthorizationSourceSnapshot> =>
  (await loadAuthorizationRequestSource(actorId, now)).snapshot;

export const loadAuthorizationRequestSourceInTransaction = (
  transaction: FirebaseFirestore.Transaction,
  actorId: string,
  now = new Date(),
): Promise<AuthorizationRequestSource> =>
  loadAuthorizationRequestSourceFromReader(
    createTransactionAuthorizationSourceReader(transaction),
    actorId,
    now,
  );
