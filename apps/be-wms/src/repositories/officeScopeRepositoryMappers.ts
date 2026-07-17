import type { OfficeScopeConfig, OfficeScopeEdge } from "@bduck/shared-types";
import type {
  OfficeScopeFacilityState,
  PersistedOfficeScopeEdgeState,
} from "../utils/officeScopePolicy.js";
import { mapFirestoreDocument } from "./facilityAccessRepositoryUtils.js";

type Snapshot = FirebaseFirestore.DocumentSnapshot;

export const mapOfficeScopeFacilityState = (
  snapshot: Snapshot,
): OfficeScopeFacilityState | null =>
  snapshot.exists
    ? ({
        id: snapshot.id,
        type: snapshot.get("type"),
        status: snapshot.get("status"),
        is_deleted: snapshot.get("is_deleted"),
      } as OfficeScopeFacilityState)
    : null;

export const mapPersistedOfficeScopeEdgeState = (
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

export const mapOfficeScopeConfig = (snapshot: Snapshot) =>
  mapFirestoreDocument<OfficeScopeConfig>(
    snapshot,
    REQUIRED_DATE_FIELDS,
    VALIDITY_DATE_FIELDS,
  );

export const mapOfficeScopeEdge = (snapshot: Snapshot) =>
  mapFirestoreDocument<OfficeScopeEdge>(
    snapshot,
    REQUIRED_DATE_FIELDS,
    VALIDITY_DATE_FIELDS,
  );

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
