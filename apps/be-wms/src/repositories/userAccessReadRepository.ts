import {
  USER_ACCESS_COLLECTION,
  USER_ACCESS_FACILITIES_SUBCOLLECTION,
  USER_ACCESS_VERSIONS_SUBCOLLECTION,
  type UserAccessMetadata,
  type UserAccessVersion,
  type UserFacilityAccessGrant,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import {
  mapUserAccessMetadata,
  mapUserAccessVersion,
  mapUserFacilityAccessGrant,
} from "./userAccessSnapshotRepositoryUtils.js";

export const getUserAccessMetadataRef = (userId: string) =>
  db.collection(USER_ACCESS_COLLECTION).doc(userId);

export const getUserAccessVersionsCollectionRef = (userId: string) =>
  getUserAccessMetadataRef(userId).collection(
    USER_ACCESS_VERSIONS_SUBCOLLECTION,
  );

export const getUserAccessVersionRef = (userId: string, versionId: string) =>
  getUserAccessVersionsCollectionRef(userId).doc(versionId);

export const getUserFacilityAccessCollectionRef = (
  userId: string,
  versionId: string,
) =>
  getUserAccessVersionRef(userId, versionId).collection(
    USER_ACCESS_FACILITIES_SUBCOLLECTION,
  );

export const getUserFacilityAccessGrantRef = (
  userId: string,
  versionId: string,
  facilityId: string,
) => getUserFacilityAccessCollectionRef(userId, versionId).doc(facilityId);

export const getUserAccessMetadata = async (
  userId: string,
  includeDeleted = false,
): Promise<UserAccessMetadata | null> => {
  const snapshot = await getUserAccessMetadataRef(userId).get();
  if (!snapshot.exists) return null;
  const metadata = mapUserAccessMetadata(snapshot);
  return !includeDeleted && metadata.is_deleted ? null : metadata;
};

export const getUserAccessVersion = async (
  userId: string,
  versionId: string,
  includeDeleted = false,
): Promise<UserAccessVersion | null> => {
  const snapshot = await getUserAccessVersionRef(userId, versionId).get();
  if (!snapshot.exists) return null;
  const version = mapUserAccessVersion(snapshot);
  return !includeDeleted && version.is_deleted ? null : version;
};

export const getActiveUserAccessVersion = async (
  userId: string,
): Promise<UserAccessVersion | null> => {
  const metadata = await getUserAccessMetadata(userId);
  if (!metadata?.active_version_id) return null;
  const version = await getUserAccessVersion(
    userId,
    metadata.active_version_id,
  );
  return version?.status === "ACTIVE" ? version : null;
};

export const findUserFacilityAccessGrants = async (
  userId: string,
  versionId: string,
  includeDeleted = false,
): Promise<UserFacilityAccessGrant[]> => {
  const snapshot = await getUserFacilityAccessCollectionRef(
    userId,
    versionId,
  ).get();
  return snapshot.docs
    .map(mapUserFacilityAccessGrant)
    .filter((grant) => includeDeleted || !grant.is_deleted);
};

export const getUserFacilityAccessGrant = async (
  userId: string,
  facilityId: string,
  versionId?: string,
): Promise<UserFacilityAccessGrant | null> => {
  const resolvedVersionId =
    versionId ?? (await getUserAccessMetadata(userId))?.active_version_id;
  if (!resolvedVersionId) return null;
  const snapshot = await getUserFacilityAccessGrantRef(
    userId,
    resolvedVersionId,
    facilityId,
  ).get();
  if (!snapshot.exists) return null;
  const grant = mapUserFacilityAccessGrant(snapshot);
  return grant.is_deleted ? null : grant;
};
