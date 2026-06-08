"use client";

import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import type {
  WarehouseLocationSlot,
  WarehouseLocationSlotProduct,
} from "@bduck/shared-types";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";

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
    throw new Error(body?.messages?.vi || "Không thể tải dữ liệu slot.");
  }

  return body.data || [];
}

async function callSlotApi(
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
    throw new Error(body?.messages?.vi || "Không thể lưu dữ liệu slot.");
  }

  return body;
}

export function useLocationSlots(warehouseId?: string, locationId?: string) {
  const [slots, setSlots] = useState<WarehouseLocationSlot[]>([]);
  const [mappings, setMappings] = useState<WarehouseLocationSlotProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSlots: (() => void) | undefined;
    let unsubscribeMappings: (() => void) | undefined;
    let isDisposed = false;

    const slotQueryString = locationId
      ? `warehouse_location_id=${locationId}`
      : warehouseId
        ? `warehouse_id=${warehouseId}`
        : "";
    const slotPath = slotQueryString
      ? `/api/location-slots?${slotQueryString}`
      : "/api/location-slots";
    const mappingPath = slotQueryString
      ? `/api/location-slots/mappings?${slotQueryString}`
      : "/api/location-slots/mappings";

    const loadApiFallback = async () => {
      try {
        const [slotData, mappingData] = await Promise.all([
          fetchCollection<WarehouseLocationSlot>(
            slotPath,
            abortController.signal,
          ),
          fetchCollection<WarehouseLocationSlotProduct>(
            mappingPath,
            abortController.signal,
          ),
        ]);
        if (isDisposed) return;
        setSlots(slotData.sort((a, b) => a.sort_order - b.sort_order));
        setMappings(mappingData);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        const message =
          apiError instanceof Error
            ? apiError.message
            : "Không thể tải dữ liệu slot.";
        console.error("[useLocationSlots] API fallback error:", apiError);
        setSlots([]);
        setMappings([]);
        setError(message);
      } finally {
        if (!isDisposed) setLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      "warehouse_location_slots",
      () => {
        void loadApiFallback();
      },
    );
    const unsubscribeMappingMutation = subscribeDataMutation(
      "warehouse_location_slot_products",
      () => {
        void loadApiFallback();
      },
    );

    setLoading(true);
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSlots) unsubscribeSlots();
      if (unsubscribeMappings) unsubscribeMappings();
      unsubscribeSlots = undefined;
      unsubscribeMappings = undefined;

      if (!user) {
        void loadApiFallback();
        return;
      }

      const slotCollection = collection(db, "warehouse_location_slots");
      const mappingCollection = collection(
        db,
        "warehouse_location_slot_products",
      );
      const slotsQuery = locationId
        ? query(
            slotCollection,
            where("warehouse_location_id", "==", locationId),
            where("is_deleted", "==", false),
          )
        : warehouseId
          ? query(
              slotCollection,
              where("warehouse_id", "==", warehouseId),
              where("is_deleted", "==", false),
            )
          : query(slotCollection, where("is_deleted", "==", false));

      const mappingsQuery = locationId
        ? query(
            mappingCollection,
            where("warehouse_location_id", "==", locationId),
            where("is_deleted", "==", false),
          )
        : warehouseId
          ? query(
              mappingCollection,
              where("warehouse_id", "==", warehouseId),
              where("is_deleted", "==", false),
            )
          : query(mappingCollection, where("is_deleted", "==", false));

      let loadedSlots = false;
      let loadedMappings = false;

      unsubscribeSlots = onSnapshot(
        slotsQuery,
        (snapshot) => {
          if (isDisposed) return;
          const data = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as WarehouseLocationSlot[];
          setSlots(data.sort((a, b) => a.sort_order - b.sort_order));
          loadedSlots = true;
          if (loadedMappings) setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          console.warn(
            "[useLocationSlots] slot snapshot error:",
            snapshotError,
          );
          void loadApiFallback();
        },
      );

      unsubscribeMappings = onSnapshot(
        mappingsQuery,
        (snapshot) => {
          if (isDisposed) return;
          setMappings(
            snapshot.docs.map((doc) => ({
              ...doc.data(),
              id: doc.id,
            })) as WarehouseLocationSlotProduct[],
          );
          loadedMappings = true;
          if (loadedSlots) setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          console.warn(
            "[useLocationSlots] mapping snapshot error:",
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
      unsubscribeMappingMutation();
      unsubscribeAuth();
      if (unsubscribeSlots) unsubscribeSlots();
      if (unsubscribeMappings) unsubscribeMappings();
    };
  }, [locationId, warehouseId]);

  const createSlot = useCallback(async (payload: unknown) => {
    const result = await callSlotApi("/api/location-slots", "POST", payload);
    emitDataMutation(["warehouse_location_slots", "audit_logs"]);
    return result;
  }, []);

  const updateSlot = useCallback(async (id: string, payload: unknown) => {
    const result = await callSlotApi(
      `/api/location-slots/${id}`,
      "PUT",
      payload,
    );
    emitDataMutation(["warehouse_location_slots", "audit_logs"]);
    return result;
  }, []);

  const deleteSlot = useCallback(async (id: string) => {
    const result = await callSlotApi(`/api/location-slots/${id}`, "DELETE");
    emitDataMutation(["warehouse_location_slots", "audit_logs"]);
    return result;
  }, []);

  const upsertMapping = useCallback(async (payload: unknown) => {
    const result = await callSlotApi(
      "/api/location-slots/mappings",
      "POST",
      payload,
    );
    emitDataMutation(["warehouse_location_slot_products", "audit_logs"]);
    return result;
  }, []);

  const deleteMapping = useCallback(async (id: string) => {
    const result = await callSlotApi(
      `/api/location-slots/mappings/${id}`,
      "DELETE",
    );
    emitDataMutation(["warehouse_location_slot_products", "audit_logs"]);
    return result;
  }, []);

  return {
    slots,
    mappings,
    loading,
    error,
    createSlot,
    updateSlot,
    deleteSlot,
    upsertMapping,
    deleteMapping,
  };
}
