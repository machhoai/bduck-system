"use client";

import { onAuthStateChanged } from "firebase/auth";
import { where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  WarehouseLocationSlot,
  WarehouseLocationSlotProduct,
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
import { callSlotApi, fetchSlotCollection } from "./locationSlotHookApi";

export function useLocationSlots(warehouseId?: string, locationId?: string) {
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
          fetchSlotCollection<WarehouseLocationSlot>(
            slotPath,
            abortController.signal,
          ),
          fetchSlotCollection<WarehouseLocationSlotProduct>(
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

      const constraints = [
        ...(locationId
          ? [where("warehouse_location_id", "==", locationId)]
          : []),
        where("is_deleted", "==", false),
      ];

      let loadedSlots = false;
      let loadedMappings = false;

      unsubscribeSlots = subscribeToMergedQueries<WarehouseLocationSlot>({
        queries: buildFacilityScopedQueries({
          db,
          collectionName: "warehouse_location_slots",
          facilityField: "warehouse_id",
          scope: queryScope,
          constraints,
        }),
        mapDocument: (document) =>
          ({
            ...document.data(),
            id: document.id,
          }) as WarehouseLocationSlot,
        onData: (data) => {
          if (isDisposed) return;
          setSlots(data.sort((a, b) => a.sort_order - b.sort_order));
          loadedSlots = true;
          if (loadedMappings) setLoading(false);
          setError(null);
        },
        onError: (snapshotError) => {
          console.warn(
            "[useLocationSlots] slot snapshot error:",
            snapshotError,
          );
          void loadApiFallback();
        },
      });

      unsubscribeMappings =
        subscribeToMergedQueries<WarehouseLocationSlotProduct>({
          queries: buildFacilityScopedQueries({
            db,
            collectionName: "warehouse_location_slot_products",
            facilityField: "warehouse_id",
            scope: queryScope,
            constraints,
          }),
          mapDocument: (document) =>
            ({
              ...document.data(),
              id: document.id,
            }) as WarehouseLocationSlotProduct,
          onData: (data) => {
            if (isDisposed) return;
            setMappings(data);
            loadedMappings = true;
            if (loadedSlots) setLoading(false);
            setError(null);
          },
          onError: (snapshotError) => {
            console.warn(
              "[useLocationSlots] mapping snapshot error:",
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
      unsubscribeMappingMutation();
      unsubscribeAuth();
      if (unsubscribeSlots) unsubscribeSlots();
      if (unsubscribeMappings) unsubscribeMappings();
    };
  }, [locationId, queryScope, warehouseId]);

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

  const deleteSlot = useCallback(
    async (id: string) => {
      const queryString = warehouseId ? `?warehouse_id=${warehouseId}` : "";
      const result = await callSlotApi(
        `/api/location-slots/${id}${queryString}`,
        "DELETE",
      );
      emitDataMutation(["warehouse_location_slots", "audit_logs"]);
      return result;
    },
    [warehouseId],
  );

  const upsertMapping = useCallback(async (payload: unknown) => {
    const result = await callSlotApi(
      "/api/location-slots/mappings",
      "POST",
      payload,
    );
    emitDataMutation(["warehouse_location_slot_products", "audit_logs"]);
    return result;
  }, []);

  const deleteMapping = useCallback(
    async (id: string) => {
      const queryString = warehouseId ? `?warehouse_id=${warehouseId}` : "";
      const result = await callSlotApi(
        `/api/location-slots/mappings/${id}${queryString}`,
        "DELETE",
      );
      emitDataMutation(["warehouse_location_slot_products", "audit_logs"]);
      return result;
    },
    [warehouseId],
  );

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
