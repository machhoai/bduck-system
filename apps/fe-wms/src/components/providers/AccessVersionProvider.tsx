"use client";

import { useEffect } from "react";
import type { UserFacilityAccessGrant } from "@bduck/shared-types";
import {
  USER_ACCESS_COLLECTION,
  USER_ACCESS_FACILITIES_SUBCOLLECTION,
  USER_ACCESS_VERSIONS_SUBCOLLECTION,
} from "@bduck/shared-types";
import {
  collection,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  type DocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  buildMaterializedPermissions,
  needsGrantReload,
  parseActiveAccessMetadata,
} from "@/lib/accessSnapshotPolicy";
import { useUserStore } from "@/stores/useUserStore";

function logAccessError(error: unknown) {
  console.error("[AccessVersionProvider] access refresh failed:", error);
}

export default function AccessVersionProvider() {
  const userId = useUserStore((state) => state.user?.id);

  useEffect(() => {
    if (!userId) return;
    const metadataRef = doc(db, USER_ACCESS_COLLECTION, userId);
    let requestGeneration = 0;
    let disposed = false;

    const applyServerSnapshot = async (
      snapshot: DocumentSnapshot,
      forceReload = false,
    ) => {
      if (disposed || snapshot.metadata.fromCache) return;
      const metadata = parseActiveAccessMetadata(userId, snapshot.data());
      if (!snapshot.exists() || !metadata) {
        requestGeneration += 1;
        useUserStore.getState().revokeAccess();
        return;
      }

      const current = useUserStore.getState();
      if (!forceReload && !needsGrantReload(current, metadata)) return;
      const generation = ++requestGeneration;
      current.beginAccessRefresh(
        metadata.access_version,
        metadata.active_version_id,
      );

      try {
        const grantsRef = collection(
          db,
          USER_ACCESS_COLLECTION,
          userId,
          USER_ACCESS_VERSIONS_SUBCOLLECTION,
          metadata.active_version_id,
          USER_ACCESS_FACILITIES_SUBCOLLECTION,
        );
        const grantsSnapshot = await getDocsFromServer(grantsRef);
        const grants = grantsSnapshot.docs.map(
          (grant) =>
            ({ id: grant.id, ...grant.data() }) as UserFacilityAccessGrant,
        );
        const permissions = buildMaterializedPermissions(metadata, grants);
        if (disposed || generation !== requestGeneration) return;
        useUserStore
          .getState()
          .applyAccessSnapshot(
            metadata.access_version,
            metadata.active_version_id,
            permissions,
          );
      } catch (error) {
        if (disposed || generation !== requestGeneration) return;
        if (window.navigator.onLine) {
          useUserStore.getState().revokeAccess("ERROR");
        } else {
          useUserStore.getState().markAccessOffline();
        }
        logAccessError(error);
      }
    };

    const unsubscribe = onSnapshot(
      metadataRef,
      { includeMetadataChanges: true },
      (snapshot) => void applyServerSnapshot(snapshot),
      (error) => {
        requestGeneration += 1;
        useUserStore.getState().revokeAccess("ERROR");
        logAccessError(error);
      },
    );

    const handleOffline = () => useUserStore.getState().markAccessOffline();
    const handleOnline = async () => {
      const reconnectGeneration = ++requestGeneration;
      const current = useUserStore.getState();
      current.beginAccessRefresh(
        current.accessVersion,
        current.activeAccessVersionId,
      );
      try {
        const snapshot = await getDocFromServer(metadataRef);
        if (disposed || reconnectGeneration !== requestGeneration) return;
        await applyServerSnapshot(snapshot, true);
      } catch (error) {
        if (disposed || reconnectGeneration !== requestGeneration) return;
        useUserStore.getState().revokeAccess("ERROR");
        logAccessError(error);
      }
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    if (!window.navigator.onLine) handleOffline();

    return () => {
      disposed = true;
      requestGeneration += 1;
      unsubscribe();
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [userId]);

  return null;
}
