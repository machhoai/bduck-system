"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  WarehouseType,
  type Warehouse,
  type WarehouseLocation,
} from "@bduck/shared-types";
import { emitDataMutation, subscribeDataMutation } from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

type ApiCollectionResponse<T> = {
  success?: boolean;
  data?: T[];
  messages?: { vi?: string; zh?: string };
};

async function fetchCollection<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T[]> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
    signal,
  });
  const body = (await response
    .json()
    .catch(() => null)) as ApiCollectionResponse<T> | null;

  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, "Khong the tai du lieu kho.");
  }

  return body.data || [];
}

async function callWarehouseApi(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  payload?: unknown,
) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, "Khong the luu du lieu kho.");
  }

  return body;
}

function getAccessibleWarehouseIds(
  permissions: Record<string, Record<string, unknown>>,
): string[] | undefined {
  const globalPerms = permissions.global || {};
  if (globalPerms["*"] === true || globalPerms["warehouses.read"] === true) {
    return undefined;
  }

  return Object.entries(permissions)
    .filter(([scope, scopedPermissions]) => {
      if (scope === "global") return false;
      return (
        scopedPermissions["*"] === true ||
        scopedPermissions["warehouses.read"] === true
      );
    })
    .map(([scope]) => scope);
}

export function useWarehouses() {
  const permissions = useUserStore((state) => state.permissions);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const accessibleWarehouseIds = getAccessibleWarehouseIds(permissions);
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const loadApiFallback = async () => {
      try {
        const data = await fetchCollection<Warehouse>(
          "/api/warehouses",
          abortController.signal,
        );
        if (isDisposed) return;
        setWarehouses(
          accessibleWarehouseIds
            ? data.filter((warehouse) =>
                accessibleWarehouseIds.includes(warehouse.id),
              )
            : data,
        );
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

      const warehousesQuery = query(
        collection(db, "warehouses"),
        where("is_deleted", "==", false),
        orderBy("created_at", "desc"),
      );

      unsubscribeSnapshot = onSnapshot(
        warehousesQuery,
        (snapshot) => {
          if (isDisposed) return;
          const data = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as Warehouse[];
          setWarehouses(
            accessibleWarehouseIds
              ? data.filter((warehouse) =>
                  accessibleWarehouseIds.includes(warehouse.id),
                )
              : data,
          );
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          console.warn("[useWarehouses] onSnapshot error:", snapshotError);
          void loadApiFallback();
        },
      );
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [permissions]);

  const createWarehouse = useCallback(
    async (payload: unknown) => {
      const result = await callWarehouseApi("/api/warehouses", "POST", payload);
      emitDataMutation(["warehouses", "audit_logs"]);
      return result;
    },
    [],
  );
  const updateWarehouse = useCallback(
    async (id: string, payload: unknown) => {
      const result = await callWarehouseApi(
        `/api/warehouses/${id}`,
        "PUT",
        payload,
      );
      emitDataMutation(["warehouses", "audit_logs"]);
      return result;
    },
    [],
  );
  const deleteWarehouse = useCallback(
    async (id: string) => {
      const result = await callWarehouseApi(
        `/api/warehouses/${id}`,
        "DELETE",
      );
      emitDataMutation(["warehouses", "audit_logs"]);
      return result;
    },
    [],
  );

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

export function useWarehouseLocations(warehouseId?: string) {
  const permissions = useUserStore((state) => state.permissions);
  const [locations, setLocations] = useState<WarehouseLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const accessibleWarehouseIds = getAccessibleWarehouseIds(permissions);
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const loadApiFallback = async () => {
      try {
        const data =
          !warehouseId && accessibleWarehouseIds
            ? (
                await Promise.all(
                  accessibleWarehouseIds.map((id) =>
                    fetchCollection<WarehouseLocation>(
                      `/api/locations?warehouse_id=${id}`,
                      abortController.signal,
                    ),
                  ),
                )
              ).flat()
            : await fetchCollection<WarehouseLocation>(
                warehouseId
                  ? `/api/locations?warehouse_id=${warehouseId}`
                  : "/api/locations",
                abortController.signal,
              );
        if (isDisposed) return;
        setLocations(
          accessibleWarehouseIds
            ? data.filter((location) =>
                accessibleWarehouseIds.includes(location.warehouse_id),
              )
            : data,
        );
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

      const locationsQuery = warehouseId
        ? query(
            collection(db, "warehouse_locations"),
            where("warehouse_id", "==", warehouseId),
            where("is_deleted", "==", false),
            orderBy("created_at", "desc"),
          )
        : query(
            collection(db, "warehouse_locations"),
            where("is_deleted", "==", false),
            orderBy("created_at", "desc"),
          );

      unsubscribeSnapshot = onSnapshot(
        locationsQuery,
        (snapshot) => {
          if (isDisposed) return;
          const data = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as WarehouseLocation[];
          setLocations(
            accessibleWarehouseIds
              ? data.filter((location) =>
                  accessibleWarehouseIds.includes(location.warehouse_id),
                )
              : data,
          );
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          console.warn(
            "[useWarehouseLocations] onSnapshot error:",
            snapshotError,
          );
          void loadApiFallback();
        },
      );
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [warehouseId, permissions]);

  const createLocation = useCallback(
    async (payload: unknown) => {
      const result = await callWarehouseApi("/api/locations", "POST", payload);
      emitDataMutation(["warehouse_locations", "warehouses", "audit_logs"]);
      return result;
    },
    [],
  );
  const updateLocation = useCallback(
    async (id: string, payload: unknown) => {
      const result = await callWarehouseApi(
        `/api/locations/${id}`,
        "PUT",
        payload,
      );
      emitDataMutation(["warehouse_locations", "warehouses", "audit_logs"]);
      return result;
    },
    [],
  );
  const deleteLocation = useCallback(
    async (id: string) => {
      const result = await callWarehouseApi(`/api/locations/${id}`, "DELETE");
      emitDataMutation(["warehouse_locations", "warehouses", "audit_logs"]);
      return result;
    },
    [],
  );

  return {
    locations,
    loading,
    error,
    createLocation,
    updateLocation,
    deleteLocation,
  };
}
