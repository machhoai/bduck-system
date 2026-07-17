"use client";

import { onAuthStateChanged } from "firebase/auth";
import { where } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import {
  externalCountApi,
  type ExternalCountSession,
} from "@/api/externalCountApi";
import { auth, db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { useUserStore } from "@/stores/useUserStore";
import {
  getFacilityPermissionScope,
  scopeContainsFacility,
} from "@/utils/facilityPermissionScope";

export function useExternalCountSessions(warehouseId?: string) {
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () =>
      getFacilityPermissionScope(permissions, [
        "external_count.view",
        "external_count.count",
      ]),
    [permissions],
  );
  const queryScope = useMemo(() => {
    if (!warehouseId) return facilityScope;
    return {
      isSystemAdmin: false,
      facilityIds: scopeContainsFacility(facilityScope, warehouseId)
        ? [warehouseId]
        : [],
    };
  }, [facilityScope, warehouseId]);
  const [sessions, setSessions] = useState<ExternalCountSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let disposed = false;
    let unsubscribeSnapshot: (() => void) | undefined;
    const loadApiFallback = async () => {
      try {
        const response = await externalCountApi.list({
          warehouse_id: warehouseId,
        });
        if (!disposed) setSessions(response.data || []);
      } catch (error) {
        console.error("[useExternalCountSessions] fallback failed", error);
        if (!disposed) setSessions([]);
      } finally {
        if (!disposed) setIsLoading(false);
      }
    };

    setIsLoading(true);
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeSnapshot?.();
      if (!user) {
        void loadApiFallback();
        return;
      }
      unsubscribeSnapshot = subscribeToMergedQueries<ExternalCountSession>({
        queries: buildFacilityScopedQueries({
          db,
          collectionName: "stock_count_sessions",
          facilityField: "warehouse_id",
          scope: queryScope,
          constraints: [
            where("source", "==", "EXTERNAL_API"),
            where("is_deleted", "==", false),
          ],
        }),
        mapDocument: (document) =>
          ({
            ...document.data(),
            id: document.id,
          }) as ExternalCountSession,
        onData: (data) => {
          if (disposed) return;
          setSessions(data);
          setIsLoading(false);
        },
        onError: () => void loadApiFallback(),
      });
    });
    return () => {
      disposed = true;
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, [queryScope, warehouseId]);

  return { sessions, isLoading };
}
