"use client";

import { onAuthStateChanged } from "firebase/auth";
import { documentId, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  WarehouseType,
  type Warehouse,
  type WarehouseLocation,
} from "@bduck/shared-types";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { useUserStore } from "@/stores/useUserStore";
import {
  getAnyFacilityScope,
  scopeContainsFacility,
} from "@/utils/facilityPermissionScope";
import { useWarehouseLocationMutations } from "./useWarehouseLocationMutations";
import { callWarehouseApi, fetchWarehouseCollection } from "./warehouseHookApi";

export function useWarehouses() {
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () => getAnyFacilityScope(permissions),
    [permissions],
  );
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const loadApiFallback = async () => {
      try {
        const data = await fetchWarehouseCollection<Warehouse>(
          "/api/warehouses",
          abortController.signal,
        );
        if (isDisposed) return;
        setWarehouses(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        const message =
          apiError instanceof Error
            ? apiError.message
            : "Không thể tải danh sách kho.";
        console.error("[useWarehouses] API fallback error:", apiError);
        setWarehouses([]);
        setError(message);
      } finally {
        if (!isDisposed) setLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation("warehouses", () => {
      void loadApiFallback();
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (!user) {
        void loadApiFallback();
        return;
      }

      unsubscribeSnapshot = subscribeToMergedQueries<Warehouse>({
        queries: buildFacilityScopedQueries({
          db,
          collectionName: "warehouses",
          facilityField: documentId(),
          scope: facilityScope,
          constraints: [where("is_deleted", "==", false)],
        }),
        mapDocument: (document) =>
          ({
            ...document.data(),
            id: document.id,
          }) as Warehouse,
        onData: (data) => {
          if (isDisposed) return;
          setWarehouses(data);
          setLoading(false);
          setError(null);
        },
        onError: (snapshotError) => {
          console.warn("[useWarehouses] onSnapshot error:", snapshotError);
          void loadApiFallback();
        },
      });
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [facilityScope]);

  const createWarehouse = useCallback(async (payload: unknown) => {
    const result = await callWarehouseApi("/api/warehouses", "POST", payload);
    emitDataMutation(["warehouses", "audit_logs"]);
    return result;
  }, []);
  const updateWarehouse = useCallback(async (id: string, payload: unknown) => {
    const result = await callWarehouseApi(
      `/api/warehouses/${id}`,
      "PUT",
      payload,
    );
    emitDataMutation(["warehouses", "audit_logs"]);
    return result;
  }, []);
  const deleteWarehouse = useCallback(async (id: string) => {
    const result = await callWarehouseApi(`/api/warehouses/${id}`, "DELETE");
    emitDataMutation(["warehouses", "audit_logs"]);
    return result;
  }, []);

  return {
    warehouses,
    loading,
    error,
    createWarehouse,
    updateWarehouse,
    deleteWarehouse,
  };
}

/** Revenue-producing locations only. */
export function useStores() {
  const warehouseState = useWarehouses();
  const stores = useMemo(
    () =>
      warehouseState.warehouses.filter(
        (warehouse) => warehouse.type === WarehouseType.STORE,
      ),
    [warehouseState.warehouses],
  );

  return { ...warehouseState, stores };
}

export function useWarehouseLocations(
  warehouseId?: string,
  options: { enabled?: boolean } = {},
) {
  const enabled = options.enabled ?? true;
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () => getAnyFacilityScope(permissions),
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
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    if (!enabled) {
      setLocations([]);
      setLoading(false);
      setError(null);
      return;
    }

    const loadApiFallback = async () => {
      try {
        const data =
          !warehouseId && !facilityScope.isSystemAdmin
            ? (
                await Promise.all(
                  facilityScope.facilityIds.map((id) =>
                    fetchWarehouseCollection<WarehouseLocation>(
                      `/api/locations?warehouse_id=${id}`,
                      abortController.signal,
                    ),
                  ),
                )
              ).flat()
            : await fetchWarehouseCollection<WarehouseLocation>(
                warehouseId
                  ? `/api/locations?warehouse_id=${warehouseId}`
                  : "/api/locations",
                abortController.signal,
              );
        if (isDisposed) return;
        setLocations(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        const message =
          apiError instanceof Error
            ? apiError.message
            : "Không thể tải danh sách vị trí.";
        console.error("[useWarehouseLocations] API fallback error:", apiError);
        setLocations([]);
        setError(message);
      } finally {
        if (!isDisposed) setLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      "warehouse_locations",
      () => {
        void loadApiFallback();
      },
    );

    setLoading(true);
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (!user) {
        void loadApiFallback();
        return;
      }

      unsubscribeSnapshot = subscribeToMergedQueries<WarehouseLocation>({
        queries: buildFacilityScopedQueries({
          db,
          collectionName: "warehouse_locations",
          facilityField: "warehouse_id",
          scope: queryScope,
          constraints: [where("is_deleted", "==", false)],
        }),
        mapDocument: (document) =>
          ({
            ...document.data(),
            id: document.id,
          }) as WarehouseLocation,
        onData: (data) => {
          if (isDisposed) return;
          setLocations(data);
          setLoading(false);
          setError(null);
        },
        onError: (snapshotError) => {
          console.warn(
            "[useWarehouseLocations] onSnapshot error:",
            snapshotError,
          );
          void loadApiFallback();
        },
      });
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [enabled, facilityScope, queryScope, warehouseId]);

  const { createLocation, updateLocation, deleteLocation } =
    useWarehouseLocationMutations();

  return {
    locations,
    loading,
    error,
    createLocation,
    updateLocation,
    deleteLocation,
  };
}
