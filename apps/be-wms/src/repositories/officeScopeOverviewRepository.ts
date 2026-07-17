import type {
  OfficeScopeConfig,
  OfficeScopeEdge,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { chunkFacilityIds } from "./facilityScopedQuery.js";
import {
  getOfficeScopeConfigRef,
  getOfficeScopeEdgesCollectionRef,
  isOfficeScopeEffectiveAt,
} from "./officeScopeRepository.js";
import {
  mapOfficeScopeConfig,
  mapOfficeScopeEdge,
} from "./officeScopeRepositoryMappers.js";

export const findOfficeScopeConfigsByOfficeIds = async (
  officeIds: readonly string[],
): Promise<OfficeScopeConfig[]> => {
  const groups = await Promise.all(
    chunkFacilityIds(officeIds).map(async (ids) => {
      const snapshots = await db.getAll(
        ...ids.map((officeId) => getOfficeScopeConfigRef(officeId)),
      );
      return snapshots
        .filter((snapshot) => snapshot.exists)
        .map(mapOfficeScopeConfig)
        .filter((config) => !config.is_deleted);
    }),
  );
  return groups.flat();
};

export const findActiveOfficeScopeEdgesByOfficeIds = async (
  officeIds: readonly string[],
  at = new Date(),
): Promise<OfficeScopeEdge[]> => {
  const groups = await Promise.all(
    chunkFacilityIds(officeIds).map(async (ids) => {
      const snapshot = await getOfficeScopeEdgesCollectionRef()
        .where("office_id", "in", ids)
        .get();
      return snapshot.docs
        .map(mapOfficeScopeEdge)
        .filter((edge) => isOfficeScopeEffectiveAt(edge, at));
    }),
  );
  return groups.flat();
};

export const countActiveEmployeesByOfficeIds = async (
  officeIds: readonly string[],
): Promise<Record<string, number>> => {
  const counts: Record<string, number> = {};
  const groups = await Promise.all(
    chunkFacilityIds(officeIds).map(async (ids) => {
      const snapshot = await db
        .collection("employee_profiles")
        .where("workplace_warehouse_id", "in", ids)
        .where("is_deleted", "==", false)
        .get();
      return snapshot.docs;
    }),
  );
  groups.flat().forEach((document) => {
    const officeId = document.get("workplace_warehouse_id");
    if (typeof officeId === "string") {
      counts[officeId] = (counts[officeId] ?? 0) + 1;
    }
  });
  return counts;
};
