import {
  OFFICE_SCOPE_CONFIGS_COLLECTION,
  OFFICE_SCOPE_EDGES_COLLECTION,
  type OfficeScopeConfig,
  type OfficeScopeEdge,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import {
  assertOfficeScopeFacilities,
  assertOfficeScopeWriteStructure,
  assertPersistedOfficeScopeEdgeOwner,
  collectAllModeSoftDeleteEdgeIds,
  type OfficeScopeFacilityState,
  type PersistedOfficeScopeEdgeState,
} from "../utils/officeScopePolicy.js";
import { mapFirestoreDocument } from "./facilityAccessRepositoryUtils.js";

type Snapshot = FirebaseFirestore.DocumentSnapshot;
type DocumentWrite<T> = {
  ref: FirebaseFirestore.DocumentReference;
  data: T;
};

export interface OfficeScopeWritePlan {
  config: DocumentWrite<OfficeScopeConfig>;
  edges: Array<DocumentWrite<OfficeScopeEdge>>;
  edgeSoftDeletes: Array<DocumentWrite<Record<string, unknown>>>;
  edgeSoftDeleteTemplate: Record<string, unknown>;
}

export type AppliedOfficeScopeWritePlan = { softDeletedEdgeIds: string[] };

export interface CreateOfficeScopeWritePlanInput {
  config: OfficeScopeConfig;
  edges: OfficeScopeEdge[];
  softDeleteEdgeIds?: string[];
  updatedBy: string;
  actionTime: Date;
  syncTime: Date;
}

const mapFacilityState = (
  snapshot: Snapshot,
): OfficeScopeFacilityState | null => {
  if (!snapshot.exists) return null;
  return {
    id: snapshot.id,
    type: snapshot.get("type"),
    status: snapshot.get("status"),
    is_deleted: snapshot.get("is_deleted"),
  } as OfficeScopeFacilityState;
};

const mapPersistedEdgeState = (
  snapshot: Snapshot,
): PersistedOfficeScopeEdgeState => ({
  id: snapshot.id,
  office_id: snapshot.get("office_id"),
  is_active: snapshot.get("is_active"),
  is_deleted: snapshot.get("is_deleted"),
});

const REQUIRED_DATE_FIELDS = [
  "created_at",
  "updated_at",
  "action_time",
  "sync_time",
];
const VALIDITY_DATE_FIELDS = ["valid_from", "valid_until"];

const mapConfig = (snapshot: Snapshot) =>
  mapFirestoreDocument<OfficeScopeConfig>(
    snapshot,
    REQUIRED_DATE_FIELDS,
    VALIDITY_DATE_FIELDS,
  );
const mapEdge = (snapshot: Snapshot) =>
  mapFirestoreDocument<OfficeScopeEdge>(
    snapshot,
    REQUIRED_DATE_FIELDS,
    VALIDITY_DATE_FIELDS,
  );

/** valid_until is inclusive: a record remains effective at the same instant. */
export const isOfficeScopeEffectiveAt = (
  record: Pick<
    OfficeScopeConfig | OfficeScopeEdge,
    "is_active" | "is_deleted" | "valid_from" | "valid_until"
  >,
  at: Date,
): boolean => {
  const atTime = at.getTime();
  return (
    record.is_active &&
    !record.is_deleted &&
    (record.valid_from === null || record.valid_from.getTime() <= atTime) &&
    (record.valid_until === null || atTime <= record.valid_until.getTime())
  );
};

export const getOfficeScopeConfigRef = (officeId: string) =>
  db.collection(OFFICE_SCOPE_CONFIGS_COLLECTION).doc(officeId);

export const getOfficeScopeEdgeRef = (edgeId: string) =>
  db.collection(OFFICE_SCOPE_EDGES_COLLECTION).doc(edgeId);

export const getOfficeScopeEdgesCollectionRef = () =>
  db.collection(OFFICE_SCOPE_EDGES_COLLECTION);

const getWarehouseRef = (warehouseId: string) =>
  db.collection("warehouses").doc(warehouseId);

const getOfficeScopeEdgesQuery = (officeId: string) =>
  getOfficeScopeEdgesCollectionRef().where("office_id", "==", officeId);

export const getOfficeScopeConfig = async (
  officeId: string,
  includeDeleted = false,
): Promise<OfficeScopeConfig | null> => {
  const snapshot = await getOfficeScopeConfigRef(officeId).get();
  if (!snapshot.exists) return null;

  const config = mapConfig(snapshot);
  return !includeDeleted && config.is_deleted ? null : config;
};

export const getActiveOfficeScopeConfig = async (
  officeId: string,
  at = new Date(),
): Promise<OfficeScopeConfig | null> => {
  const config = await getOfficeScopeConfig(officeId);
  return config && isOfficeScopeEffectiveAt(config, at) ? config : null;
};

export const findOfficeScopeEdges = async (
  officeId: string,
  includeDeleted = false,
): Promise<OfficeScopeEdge[]> => {
  const snapshot = await getOfficeScopeEdgesQuery(officeId).get();

  return snapshot.docs
    .map(mapEdge)
    .filter((edge) => includeDeleted || !edge.is_deleted);
};

export const findActiveOfficeScopeEdges = async (
  officeId: string,
  at = new Date(),
): Promise<OfficeScopeEdge[]> => {
  const edges = await findOfficeScopeEdges(officeId);
  return edges.filter((edge) => isOfficeScopeEffectiveAt(edge, at));
};

export const getActiveOfficeScopeEdge = async (
  officeId: string,
  targetFacilityId: string,
  at = new Date(),
): Promise<OfficeScopeEdge | null> => {
  const edges = await findActiveOfficeScopeEdges(officeId, at);
  return (
    edges.find((edge) => edge.target_facility_id === targetFacilityId) ?? null
  );
};

export const createOfficeScopeWritePlan = ({
  config,
  edges,
  softDeleteEdgeIds = [],
  updatedBy,
  actionTime,
  syncTime,
}: CreateOfficeScopeWritePlanInput): OfficeScopeWritePlan => {
  assertOfficeScopeWriteStructure(config, edges, softDeleteEdgeIds);

  const edgeSoftDeleteTemplate = {
    is_deleted: true,
    is_active: false,
    updated_by: updatedBy,
    updated_at: syncTime,
    action_time: actionTime,
    sync_time: syncTime,
  };

  return {
    config: {
      ref: getOfficeScopeConfigRef(config.office_id),
      data: config,
    },
    edges: edges.map((edge) => ({
      ref: getOfficeScopeEdgeRef(edge.id),
      data: edge,
    })),
    edgeSoftDeletes: Array.from(new Set(softDeleteEdgeIds)).map((edgeId) => ({
      ref: getOfficeScopeEdgeRef(edgeId),
      data: edgeSoftDeleteTemplate,
    })),
    edgeSoftDeleteTemplate,
  };
};

export const applyOfficeScopeWritePlanInTransaction = async (
  transaction: FirebaseFirestore.Transaction,
  plan: OfficeScopeWritePlan,
): Promise<AppliedOfficeScopeWritePlan> => {
  const officeId = plan.config.data.office_id;
  const edgeData = plan.edges.map(({ data }) => data);
  const explicitSoftDeleteIds = plan.edgeSoftDeletes.map(({ ref }) => ref.id);
  assertOfficeScopeWriteStructure(
    plan.config.data,
    edgeData,
    explicitSoftDeleteIds,
  );
  if (plan.config.ref.id !== officeId) {
    throw new Error("OFFICE_SCOPE_CONFIG_REF_MISMATCH");
  }
  plan.edges.forEach(({ ref, data }) => {
    if (ref.id !== data.id) throw new Error("OFFICE_SCOPE_EDGE_REF_MISMATCH");
  });

  const [
    officeFacilitySnapshot,
    persistedEdgesSnapshot,
    edgeWriteSnapshots,
    edgeSoftDeleteSnapshots,
    targetFacilitySnapshots,
  ] = await Promise.all([
    transaction.get(getWarehouseRef(officeId)),
    transaction.get(getOfficeScopeEdgesQuery(officeId)),
    Promise.all(plan.edges.map(({ ref }) => transaction.get(ref))),
    Promise.all(plan.edgeSoftDeletes.map(({ ref }) => transaction.get(ref))),
    Promise.all(
      edgeData.map((edge) =>
        transaction.get(getWarehouseRef(edge.target_facility_id)),
      ),
    ),
  ]);

  edgeWriteSnapshots.forEach((snapshot) => {
    assertPersistedOfficeScopeEdgeOwner(
      snapshot.exists,
      snapshot.exists ? snapshot.get("office_id") : undefined,
      officeId,
      true,
    );
  });
  edgeSoftDeleteSnapshots.forEach((snapshot) => {
    assertPersistedOfficeScopeEdgeOwner(
      snapshot.exists,
      snapshot.exists ? snapshot.get("office_id") : undefined,
      officeId,
      false,
    );
  });

  const targetFacilities = new Map<string, OfficeScopeFacilityState | null>();
  edgeData.forEach((edge, index) => {
    targetFacilities.set(
      edge.target_facility_id,
      mapFacilityState(targetFacilitySnapshots[index]),
    );
  });
  assertOfficeScopeFacilities(
    officeId,
    mapFacilityState(officeFacilitySnapshot),
    edgeData,
    targetFacilities,
  );

  const automaticSoftDeleteIds = collectAllModeSoftDeleteEdgeIds(
    plan.config.data,
    persistedEdgesSnapshot.docs.map(mapPersistedEdgeState),
  );
  const softDeletesById = new Map(
    plan.edgeSoftDeletes.map(({ ref, data }) => [ref.id, { ref, data }]),
  );
  automaticSoftDeleteIds.forEach((edgeId) => {
    if (!softDeletesById.has(edgeId)) {
      softDeletesById.set(edgeId, {
        ref: getOfficeScopeEdgeRef(edgeId),
        data: plan.edgeSoftDeleteTemplate,
      });
    }
  });

  transaction.set(plan.config.ref, plan.config.data, { merge: true });
  plan.edges.forEach(({ ref, data }) => {
    transaction.set(ref, data, { merge: true });
  });
  softDeletesById.forEach(({ ref, data }) => {
    transaction.update(ref, data);
  });

  return { softDeletedEdgeIds: Array.from(softDeletesById.keys()).sort() };
};
