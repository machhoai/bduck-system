"use client";

import { onAuthStateChanged } from "firebase/auth";
import { useEffect, useMemo, useState } from "react";
import type { Inventory } from "@bduck/shared-types";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { useUserStore } from "@/stores/useUserStore";
import { createDetailedApiError } from "@/utils/apiError";
import { getFacilityPermissionScope } from "@/utils/facilityPermissionScope";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function fetchInventoryFromApi(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/inventory`, {
    credentials: "include",
    signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, "Khong the tai du lieu ton kho.");
  }
  return (body.data || []) as Inventory[];
}

export function useInventory() {
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () => getFacilityPermissionScope(permissions, ["inventory.read"]),
    [permissions],
  );
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let disposed = false;

    const loadApiFallback = async () => {
      try {
        const data = await fetchInventoryFromApi(abortController.signal);
        if (!disposed) {
          setInventory(data);
          setError(null);
        }
      } catch (apiError) {
        if (!disposed) {
          console.error("[useInventory] API fallback error:", apiError);
          setInventory([]);
          setError(apiError instanceof Error ? apiError.message : "Khong the tai ton kho.");
        }
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      "inventory",
      () => void loadApiFallback(),
    );
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeSnapshot?.();
      unsubscribeSnapshot = undefined;
      if (!user) {
        void loadApiFallback();
        return;
      }
      unsubscribeSnapshot = subscribeToMergedQueries<Inventory>({
        queries: buildFacilityScopedQueries({
          db,
          collectionName: "inventory",
          facilityField: "warehouse_id",
          scope: facilityScope,
        }),
        mapDocument: (document) => ({
          ...document.data(),
          id: document.id,
        }) as Inventory,
        onData: (data) => {
          if (disposed) return;
          setInventory(data);
          setLoading(false);
          setError(null);
        },
        onError: (snapshotError) => {
          console.error("[useInventory] onSnapshot error:", snapshotError);
          void loadApiFallback();
        },
      });
    });

    return () => {
      disposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, [facilityScope]);

  return { inventory, loading, error };
}
