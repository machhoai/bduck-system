"use client";

import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import type {
  InventoryStockPolicy,
  StockPolicyScope,
} from "@bduck/shared-types";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

type ApiCollectionResponse<T> = {
  success?: boolean;
  data?: T[];
  messages?: { vi?: string };
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
    throw createDetailedApiError(response, body, "Khong the tai chinh sach ton kho.");
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
    throw createDetailedApiError(response, body, "Khong the luu chinh sach ton kho.");
  }

  return body;
}

export function useStockPolicies(filters: UseStockPoliciesFilters) {
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

      let policiesQuery = query(
        collection(db, "inventory_stock_policies"),
        where("is_deleted", "==", false),
      );
      if (filters.warehouseId) {
        policiesQuery = query(
          policiesQuery,
          where("warehouse_id", "==", filters.warehouseId),
        );
      }
      if (filters.locationId) {
        policiesQuery = query(
          policiesQuery,
          where("warehouse_location_id", "==", filters.locationId),
        );
      }
      if (filters.slotId) {
        policiesQuery = query(
          policiesQuery,
          where("warehouse_location_slot_id", "==", filters.slotId),
        );
      }
      if (filters.productId) {
        policiesQuery = query(
          policiesQuery,
          where("product_id", "==", filters.productId),
        );
      }
      if (filters.scope) {
        policiesQuery = query(
          policiesQuery,
          where("scope", "==", filters.scope),
        );
      }

      unsubscribeSnapshot = onSnapshot(
        policiesQuery,
        (snapshot) => {
          if (isDisposed) return;
          setPolicies(
            snapshot.docs.map((doc) => ({
              ...doc.data(),
              id: doc.id,
            })) as InventoryStockPolicy[],
          );
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          console.warn("[useStockPolicies] snapshot error:", snapshotError);
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
  }, [
    filters.locationId,
    filters.productId,
    filters.scope,
    filters.slotId,
    filters.warehouseId,
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
