"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import type { Warehouse, WarehouseLocation } from "@bduck/shared-types";
import { auth, db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

type ApiCollectionResponse<T> = {
  success?: boolean;
  data?: T[];
  messages?: { vi?: string };
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
    throw new Error(body?.messages?.vi || "Không thể tải dữ liệu kho.");
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
    throw new Error(body?.messages?.vi || "Không thể lưu dữ liệu kho.");
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
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [permissions]);

  const createWarehouse = useCallback(
    (payload: unknown) => callWarehouseApi("/api/warehouses", "POST", payload),
    [],
  );
  const updateWarehouse = useCallback(
    (id: string, payload: unknown) =>
      callWarehouseApi(`/api/warehouses/${id}`, "PUT", payload),
    [],
  );
  const deleteWarehouse = useCallback(
    (id: string) => callWarehouseApi(`/api/warehouses/${id}`, "DELETE"),
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
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [warehouseId, permissions]);

  const createLocation = useCallback(
    (payload: unknown) => callWarehouseApi("/api/locations", "POST", payload),
    [],
  );
  const updateLocation = useCallback(
    (id: string, payload: unknown) =>
      callWarehouseApi(`/api/locations/${id}`, "PUT", payload),
    [],
  );
  const deleteLocation = useCallback(
    (id: string) => callWarehouseApi(`/api/locations/${id}`, "DELETE"),
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
