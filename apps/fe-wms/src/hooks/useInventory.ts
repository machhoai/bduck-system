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
import { auth, db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";

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
    const accessibleWarehouseIds = getAccessibleWarehouseIds(permissions);
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    // If user has no warehouse access, return empty
    if (accessibleWarehouseIds && accessibleWarehouseIds.length === 0) {
      setInventory([]);
      setLoading(false);
      return;
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (!user) {
        if (!isDisposed) {
          setInventory([]);
          setLoading(false);
        }
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

          // RBAC filter: only show inventory from accessible warehouses
          const filtered = accessibleWarehouseIds
            ? data.filter((item) =>
                accessibleWarehouseIds.includes(item.warehouse_id),
              )
            : data;

          setInventory(filtered);
          setLoading(false);
          setError(null);
        },
        (snapshotError) => {
          if (isDisposed) return;
          console.error("[useInventory] onSnapshot error:", snapshotError);
          setError("Không thể tải dữ liệu tồn kho.");
          setLoading(false);
        },
      );
    });

    return () => {
      isDisposed = true;
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [permissions]);

  return { inventory, loading, error };
}
