"use client";

/**
 * useTransferOrders — Realtime Firebase listener for transfer orders
 *
 * LUẬT THÉP: No reload buttons. Orders update via onSnapshot.
 *
 * RBAC: Filters client-side by:
 * 1. User is creator (creator_id === userId)
 * 2. Order belongs to a warehouse in user's permission scope
 */

import { useEffect, useState, useMemo } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";
import type { TransferOrder } from "@bduck/shared-types";
import { TransferOrderStatus } from "@bduck/shared-types";

const ACTIVE_STATUSES: string[] = [
  TransferOrderStatus.DRAFT,
  TransferOrderStatus.PENDING_APPROVAL,
  TransferOrderStatus.APPROVED,
  TransferOrderStatus.EXPORT_PENDING,
  TransferOrderStatus.EXPORT_CREATED,
  TransferOrderStatus.PICKING,
  TransferOrderStatus.IN_TRANSIT,
  TransferOrderStatus.PENDING_RECEIVE,
  TransferOrderStatus.RECEIVING,
  TransferOrderStatus.REJECTED,
];

const COMPLETED_STATUSES: string[] = [
  TransferOrderStatus.COMPLETED,
  TransferOrderStatus.CANCELLED,
];

interface UseTransferOrdersReturn {
  activeOrders: TransferOrder[];
  completedOrders: TransferOrder[];
  loading: boolean;
}

export function useTransferOrders(): UseTransferOrdersReturn {
  const [rawOrders, setRawOrders] = useState<TransferOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUserStore((s) => s.user);
  const permissions = useUserStore((s) => s.permissions);

  const accessibleWarehouseIds = useMemo(() => {
    if (!permissions) return { isGlobal: false, ids: [] as string[] };
    const globalPerms = permissions["global"] || {};
    if (globalPerms["*"] === true || globalPerms["transfers.read"] === true) {
      return { isGlobal: true, ids: [] as string[] };
    }
    const ids: string[] = [];
    for (const [scope, perms] of Object.entries(permissions)) {
      if (scope === "global") continue;
      if (
        perms["*"] === true ||
        perms["transfers.read"] === true ||
        perms["vouchers.read"] === true
      ) {
        ids.push(scope);
      }
    }
    return { isGlobal: false, ids };
  }, [permissions]);

  useEffect(() => {
    if (!user?.id) {
      setRawOrders([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "transfer_orders"),
      where("is_deleted", "==", false),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const orders: TransferOrder[] = [];
        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() } as TransferOrder;
          if (accessibleWarehouseIds.isGlobal) {
            orders.push(data);
          } else {
            const isCreator = data.creator_id === user.id;
            const srcInScope = accessibleWarehouseIds.ids.includes(
              data.source_warehouse_id,
            );
            const dstInScope = accessibleWarehouseIds.ids.includes(
              data.destination_warehouse_id,
            );
            if (isCreator || srcInScope || dstInScope) orders.push(data);
          }
        });

        setRawOrders(
          orders.sort((a, b) => {
            const aTime =
              a.created_at instanceof Date
                ? a.created_at.getTime()
                : new Date(a.created_at as unknown as string).getTime();
            const bTime =
              b.created_at instanceof Date
                ? b.created_at.getTime()
                : new Date(b.created_at as unknown as string).getTime();
            return bTime - aTime;
          }),
        );
        setLoading(false);
      },
      (error) => {
        console.error("[useTransferOrders] onSnapshot error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.id, accessibleWarehouseIds]);

  const activeOrders = useMemo(
    () => rawOrders.filter((o) => ACTIVE_STATUSES.includes(o.status)),
    [rawOrders],
  );

  const completedOrders = useMemo(
    () => rawOrders.filter((o) => COMPLETED_STATUSES.includes(o.status)),
    [rawOrders],
  );

  return { activeOrders, completedOrders, loading };
}
