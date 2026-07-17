"use client";

import { useEffect, useMemo, useState } from "react";
import { where } from "firebase/firestore";
import {
  TransferOrderStatus,
  type TransferOrder,
} from "@bduck/shared-types";
import { db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { useUserStore } from "@/stores/useUserStore";
import { getFacilityPermissionScope } from "@/utils/facilityPermissionScope";

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

const time = (value: unknown) => {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return new Date(value as string).getTime();
};

export function useTransferOrders() {
  const [rawOrders, setRawOrders] = useState<TransferOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = useUserStore((state) => state.user?.id);
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () => getFacilityPermissionScope(permissions, ["transfers.read"]),
    [permissions],
  );

  useEffect(() => {
    if (!userId) {
      setRawOrders([]);
      setLoading(false);
      return;
    }
    const constraints = [where("is_deleted", "==", false)];
    const sourceQueries = buildFacilityScopedQueries({
      db,
      collectionName: "transfer_orders",
      facilityField: "source_warehouse_id",
      scope: facilityScope,
      constraints,
    });
    const queries = facilityScope.isSystemAdmin
      ? sourceQueries
      : sourceQueries.concat(
          buildFacilityScopedQueries({
            db,
            collectionName: "transfer_orders",
            facilityField: "destination_warehouse_id",
            scope: facilityScope,
            constraints,
          }),
        );
    return subscribeToMergedQueries<TransferOrder>({
      queries,
      mapDocument: (document) => ({
        id: document.id,
        ...document.data(),
      }) as TransferOrder,
      onData: (orders) => {
        setRawOrders(orders.sort((left, right) => time(right.created_at) - time(left.created_at)));
        setLoading(false);
      },
      onError: (error) => {
        console.error("[useTransferOrders] onSnapshot error:", error);
        setLoading(false);
      },
    });
  }, [facilityScope, userId]);

  const activeOrders = useMemo(
    () => rawOrders.filter((order) => ACTIVE_STATUSES.includes(order.status)),
    [rawOrders],
  );
  const completedOrders = useMemo(
    () => rawOrders.filter((order) => COMPLETED_STATUSES.includes(order.status)),
    [rawOrders],
  );
  return { activeOrders, completedOrders, loading };
}
