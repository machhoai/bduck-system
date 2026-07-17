"use client";

import { onAuthStateChanged } from "firebase/auth";
import { where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  InventoryStockPolicy,
  StockPolicyScope,
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
import { createDetailedApiError } from "@/utils/apiError";
import {
  getFacilityPermissionScope,
  scopeContainsFacility,
} from "@/utils/facilityPermissionScope";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

type ApiCollectionResponse<T> = {
  success?: boolean;
  data?: T[];
  messages?: { vi?: string; zh?: string };
};

interface UseStockPoliciesFilters {
  warehouseId?: string;
  locationId?: string;
  slotId?: string;
  productId?: string;
  scope?: StockPolicyScope;
}

function toQueryString(filters: UseStockPoliciesFilters) {
  const params = new URLSearchParams();
  if (filters.warehouseId) params.set("warehouse_id", filters.warehouseId);
  if (filters.locationId)
    params.set("warehouse_location_id", filters.locationId);
  if (filters.slotId) params.set("warehouse_location_slot_id", filters.slotId);
  if (filters.productId) params.set("product_id", filters.productId);
  if (filters.scope) params.set("scope", filters.scope);
  return params.toString();
}

async function fetchPolicies(
  filters: UseStockPoliciesFilters,
  signal?: AbortSignal,
): Promise<InventoryStockPolicy[]> {
  const qs = toQueryString(filters);
  const response = await fetch(
    `${API_BASE_URL}/api/stock-policies${qs ? `?${qs}` : ""}`,
    {
      method: "GET",
      credentials: "include",
      signal,
    },
  );
  const body = (await response
    .json()
    .catch(() => null)) as ApiCollectionResponse<InventoryStockPolicy> | null;

  if (!response.ok || !body?.success) {
    throw createDetailedApiError(
      response,
      body,
      "Khong the tai chinh sach ton kho.",
    );
  }

  return body.data || [];
}

async function callStockPolicyApi(
  path: string,
  method: "POST" | "DELETE",
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
    throw createDetailedApiError(
      response,
      body,
      "Khong the luu chinh sach ton kho.",
    );
  }

  return body;
}

export function useStockPolicies(filters: UseStockPoliciesFilters) {
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () => getFacilityPermissionScope(permissions, ["inventory.read"]),
    [permissions],
  );
  const queryScope = useMemo(() => {
    if (!filters.warehouseId) return facilityScope;
    return {
      isSystemAdmin: false,
      facilityIds: scopeContainsFacility(facilityScope, filters.warehouseId)
        ? [filters.warehouseId]
        : [],
    };
  }, [facilityScope, filters.warehouseId]);
  const [policies, setPolicies] = useState<InventoryStockPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const loadApiFallback = async () => {
      try {
        const data = await fetchPolicies(filters, abortController.signal);
        if (isDisposed) return;
        setPolicies(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        const message =
          apiError instanceof Error
            ? apiError.message
            : "Không thể tải chính sách tồn kho.";
        console.error("[useStockPolicies] API fallback error:", apiError);
        setPolicies([]);
        setError(message);
      } finally {
        if (!isDisposed) setLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      "inventory_stock_policies",
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

      const constraints = [where("is_deleted", "==", false)];
      if (filters.locationId) {
        constraints.push(
          where("warehouse_location_id", "==", filters.locationId),
        );
      }
      if (filters.slotId) {
        constraints.push(
          where("warehouse_location_slot_id", "==", filters.slotId),
        );
      }
      if (filters.productId) {
        constraints.push(where("product_id", "==", filters.productId));
      }
      if (filters.scope) {
        constraints.push(where("scope", "==", filters.scope));
      }

      unsubscribeSnapshot = subscribeToMergedQueries<InventoryStockPolicy>({
        queries: buildFacilityScopedQueries({
          db,
          collectionName: "inventory_stock_policies",
          facilityField: "warehouse_id",
          scope: queryScope,
          constraints,
        }),
        mapDocument: (document) =>
          ({
            ...document.data(),
            id: document.id,
          }) as InventoryStockPolicy,
        onData: (data) => {
          if (isDisposed) return;
          setPolicies(data);
          setLoading(false);
          setError(null);
        },
        onError: (snapshotError) => {
          console.warn("[useStockPolicies] snapshot error:", snapshotError);
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
  }, [
    filters.locationId,
    filters.productId,
    filters.scope,
    filters.slotId,
    filters.warehouseId,
    queryScope,
  ]);

  const upsertPolicy = useCallback(async (payload: unknown) => {
    const result = await callStockPolicyApi(
      "/api/stock-policies",
      "POST",
      payload,
    );
    emitDataMutation(["inventory_stock_policies", "audit_logs"]);
    return result;
  }, []);

  const deletePolicy = useCallback(async (id: string) => {
    const result = await callStockPolicyApi(
      `/api/stock-policies/${id}`,
      "DELETE",
    );
    emitDataMutation(["inventory_stock_policies", "audit_logs"]);
    return result;
  }, []);

  return {
    policies,
    loading,
    error,
    upsertPolicy,
    deletePolicy,
  };
}
