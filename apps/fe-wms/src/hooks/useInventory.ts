"use client";

/**
 * useInventory — Real-time Firestore listener for inventory collection
 *
 * ► LUẬT THÉP: Dữ liệu tồn kho cập nhật real-time qua onSnapshot
 * ► RBAC: Chỉ trả về inventory records thuộc kho mà user có quyền
 * ► Denormalized warehouse_id cho phép filter trực tiếp
 */

import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query } from "firebase/firestore";
import { useEffect, useState } from "react";
import type { Inventory } from "@bduck/shared-types";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function fetchInventoryFromApi(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/inventory`, {
    method: "GET",
    credentials: "include",
    signal,
  });
  const body = await response.json().catch(() => null);

  if (!response.ok || !body?.success) {
    throw new Error(body?.messages?.vi || "Không thể tải dữ liệu tồn kho.");
  }

  return (body.data || []) as Inventory[];
}

function getAccessibleWarehouseIds(
  permissions: Record<string, Record<string, unknown>>,
): string[] | undefined {
  const globalPerms = permissions.global || {};
  if (globalPerms["*"] === true || globalPerms["warehouses.read"] === true) {
    return undefined; // All warehouses accessible
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

export function useInventory() {
  const permissions = useUserStore((state) => state.permissions);
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    const accessibleWarehouseIds = getAccessibleWarehouseIds(permissions);
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const applyInventoryFilter = (data: Inventory[]) =>
      accessibleWarehouseIds
        ? data.filter((item) =>
            accessibleWarehouseIds.includes(item.warehouse_id),
          )
        : data;

    // If user has no warehouse access, return empty
    if (accessibleWarehouseIds && accessibleWarehouseIds.length === 0) {
      setInventory([]);
      setLoading(false);
      return;
    }

    const loadApiFallback = async () => {
      try {
        const data = await fetchInventoryFromApi(abortController.signal);
        if (isDisposed) return;
        setInventory(applyInventoryFilter(data));
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        console.error("[useInventory] API fallback error:", apiError);
        setInventory([]);
        setError(
          apiError instanceof Error
            ? apiError.message
            : "Không thể tải dữ liệu tồn kho.",
        );
      } finally {
        if (!isDisposed) setLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation("inventory", () => {
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

      const inventoryQuery = query(collection(db, "inventory"));

      unsubscribeSnapshot = onSnapshot(
        inventoryQuery,
        (snapshot) => {
          if (isDisposed) return;
          const data = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as Inventory[];

          setInventory(applyInventoryFilter(data));
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          console.error("[useInventory] onSnapshot error:", snapshotError);
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

  return { inventory, loading, error };
}
