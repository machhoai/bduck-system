"use client";

/**
 * useImportVouchers — Realtime Firebase listener for import vouchers
 *
 * LUẬT THÉP: No reload buttons. Vouchers update via onSnapshot.
 *
 * RBAC: Filters vouchers client-side by:
 * 1. User is creator (creator_id === userId)
 * 2. Voucher belongs to a warehouse in user's permission scope
 *
 * Returns:
 * - activeVouchers: status in [DRAFT, PENDING_APPROVAL, APPROVED, RECEIVING]
 * - completedVouchers: status in [COMPLETED, CANCELLED]
 * - loading: Skeleton loading state
 */

import { useEffect, useState, useMemo } from "react";
import {
  collection,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";
import type { ImportVoucher } from "@bduck/shared-types";
import { ImportVoucherStatus } from "@bduck/shared-types";

// ─────────────────────────────────────────────
// STATUS GROUPS
// ─────────────────────────────────────────────

const ACTIVE_STATUSES: string[] = [
  ImportVoucherStatus.DRAFT,
  ImportVoucherStatus.PENDING_APPROVAL,
  ImportVoucherStatus.APPROVED,
  ImportVoucherStatus.RECEIVING,
];

const COMPLETED_STATUSES: string[] = [
  ImportVoucherStatus.COMPLETED,
  ImportVoucherStatus.CANCELLED,
];

// ─────────────────────────────────────────────
// HOOK
// ─────────────────────────────────────────────

interface UseImportVouchersReturn {
  activeVouchers: ImportVoucher[];
  completedVouchers: ImportVoucher[];
  allVouchers: ImportVoucher[];
  loading: boolean;
}

export function useImportVouchers(): UseImportVouchersReturn {
  const [rawVouchers, setRawVouchers] = useState<ImportVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const user = useUserStore((s) => s.user);
  const permissions = useUserStore((s) => s.permissions);

  // Extract warehouse IDs user has vouchers.read access to
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

    // Query all non-deleted vouchers ordered by creation date
    const q = query(
      collection(db, "import_vouchers"),
      where("is_deleted", "==", false),
      orderBy("created_at", "desc"),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const vouchers: ImportVoucher[] = [];
        snapshot.forEach((doc) => {
          const data = { id: doc.id, ...doc.data() } as ImportVoucher;

          // ── RBAC filter ──
          if (accessibleWarehouseIds.isGlobal) {
            vouchers.push(data);
          } else {
            const isCreator = data.creator_id === user.id;
            const inScope = accessibleWarehouseIds.ids.includes(
              data.warehouse_id,
            );
            if (isCreator || inScope) {
              vouchers.push(data);
            }
          }
        });

        setRawVouchers(vouchers);
        setLoading(false);
      },
      (error) => {
        console.error("[useImportVouchers] onSnapshot error:", error);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [user?.id, accessibleWarehouseIds]);

  // ── Split into active / completed ──
  const activeVouchers = useMemo(
    () => rawVouchers.filter((v) => ACTIVE_STATUSES.includes(v.status)),
    [rawVouchers],
  );

  const completedVouchers = useMemo(
    () => rawVouchers.filter((v) => COMPLETED_STATUSES.includes(v.status)),
    [rawVouchers],
  );

  return {
    activeVouchers,
    completedVouchers,
    allVouchers: rawVouchers,
    loading,
  };
}
