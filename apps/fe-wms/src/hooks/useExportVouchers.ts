"use client";

import { useEffect, useMemo, useState } from "react";
import { where } from "firebase/firestore";
import {
  ExportVoucherStatus,
  type ExportVoucher,
} from "@bduck/shared-types";
import { db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { useUserStore } from "@/stores/useUserStore";
import { getFacilityPermissionScope } from "@/utils/facilityPermissionScope";

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

const time = (value: unknown) => {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return new Date(value as string).getTime();
};

export function useExportVouchers() {
  const [rawVouchers, setRawVouchers] = useState<ExportVoucher[]>([]);
  const [loading, setLoading] = useState(true);
  const userId = useUserStore((state) => state.user?.id);
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () => getFacilityPermissionScope(permissions, ["vouchers.read"]),
    [permissions],
  );

  useEffect(() => {
    if (!userId) {
      setRawVouchers([]);
      setLoading(false);
      return;
    }
    return subscribeToMergedQueries<ExportVoucher>({
      queries: buildFacilityScopedQueries({
        db,
        collectionName: "export_vouchers",
        facilityField: "warehouse_id",
        scope: facilityScope,
        constraints: [where("is_deleted", "==", false)],
      }),
      mapDocument: (document) => ({
        id: document.id,
        ...document.data(),
      }) as ExportVoucher,
      onData: (vouchers) => {
        setRawVouchers(vouchers.sort((left, right) => time(right.created_at) - time(left.created_at)));
        setLoading(false);
      },
      onError: (error) => {
        console.error("[useExportVouchers] onSnapshot error:", error);
        setLoading(false);
      },
    });
  }, [facilityScope, userId]);

  const activeVouchers = useMemo(
    () => rawVouchers.filter((voucher) => ACTIVE_STATUSES.includes(voucher.status)),
    [rawVouchers],
  );
  const completedVouchers = useMemo(
    () => rawVouchers.filter((voucher) => COMPLETED_STATUSES.includes(voucher.status)),
    [rawVouchers],
  );
  return { activeVouchers, completedVouchers, loading };
}
