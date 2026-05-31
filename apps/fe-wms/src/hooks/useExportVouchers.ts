"use client";

/**
 * useExportVouchers — Realtime Firebase listener for export vouchers
 *
 * LUẬT THÉP: No reload buttons. Vouchers update via onSnapshot.
 *
 * RBAC: Filters vouchers client-side by:
 * 1. User is creator (creator_id === userId)
 * 2. Voucher belongs to a warehouse in user's permission scope
 */

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";
import type { ExportVoucher } from "@bduck/shared-types";
import { ExportVoucherStatus } from "@bduck/shared-types";

const ACTIVE_STATUSES: string[] = [
  ExportVoucherStatus.DRAFT,
  ExportVoucherStatus.PENDING_APPROVAL,
  ExportVoucherStatus.APPROVED,
  ExportVoucherStatus.REJECTED,
  ExportVoucherStatus.PICKING,
  ExportVoucherStatus.SHIPPED,
];

const COMPLETED_STATUSES: string[] = [
  ExportVoucherStatus.COMPLETED,
  ExportVoucherStatus.CANCELLED,
];

interface UseExportVouchersReturn {
  activeVouchers: ExportVoucher[];
  completedVouchers: ExportVoucher[];
  loading: boolean;
}

export function useExportVouchers(): UseExportVouchersReturn {
  const [rawVouchers, setRawVouchers] = useState<ExportVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUserStore((s) => s.user);
  const permissions = useUserStore((s) => s.permissions);

  const accessibleWarehouseIds = useMemo(() => {
    if (!permissions) return { isGlobal: false, ids: [] as string[] };
    const globalPerms = permissions["global"] || {};
    if (globalPerms["*"] === true || globalPerms["vouchers.read"] === true) {
      return { isGlobal: true, ids: [] as string[] };
    }
    const ids: string[] = [];
    for (const [scope, perms] of Object.entries(permissions)) {
      if (scope === "global") continue;
      if (perms["*"] === true || perms["vouchers.read"] === true) {
        ids.push(scope);
      }
    }
    return { isGlobal: false, ids };
  }, [permissions]);

  useEffect(() => {
    if (!user?.id) {
      setRawVouchers([]);
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "export_vouchers"),
      where("is_deleted", "==", false),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const vouchers: ExportVoucher[] = [];
        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() } as ExportVoucher;
          if (accessibleWarehouseIds.isGlobal) {
            vouchers.push(data);
          } else {
            const isCreator = data.creator_id === user.id;
            const inScope = accessibleWarehouseIds.ids.includes(data.warehouse_id);
            if (isCreator || inScope) vouchers.push(data);
          }
        });

        setRawVouchers(
          vouchers.sort((a, b) => {
            const aTime = a.created_at instanceof Date ? a.created_at.getTime() : new Date(a.created_at as any).getTime();
            const bTime = b.created_at instanceof Date ? b.created_at.getTime() : new Date(b.created_at as any).getTime();
            return bTime - aTime;
          }),
        );
        setLoading(false);
      },
      (error) => {
        console.error("[useExportVouchers] onSnapshot error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.id, accessibleWarehouseIds]);

  const activeVouchers = useMemo(
    () => rawVouchers.filter((v) => ACTIVE_STATUSES.includes(v.status)),
    [rawVouchers],
  );

  const completedVouchers = useMemo(
    () => rawVouchers.filter((v) => COMPLETED_STATUSES.includes(v.status)),
    [rawVouchers],
  );

  return { activeVouchers, completedVouchers, loading };
}
