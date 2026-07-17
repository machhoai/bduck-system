"use client";

import { useEffect, useMemo, useState } from "react";
import { where } from "firebase/firestore";
import {
  ImportVoucherStatus,
  type ImportVoucher,
} from "@bduck/shared-types";
import { db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { useUserStore } from "@/stores/useUserStore";
import { getFacilityPermissionScope } from "@/utils/facilityPermissionScope";

const ACTIVE_STATUSES: string[] = [
  ImportVoucherStatus.DRAFT,
  ImportVoucherStatus.PENDING_APPROVAL,
  ImportVoucherStatus.APPROVED,
  ImportVoucherStatus.RECEIVING,
];
const COMPLETED_STATUSES: string[] = [
  ImportVoucherStatus.COMPLETED,
  ImportVoucherStatus.REJECTED,
  ImportVoucherStatus.CANCELLED,
];

const time = (value: unknown) => {
  if (value instanceof Date) return value.getTime();
  if (value && typeof value === "object" && "toDate" in value) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return new Date(value as string).getTime();
};

export function useImportVouchers() {
  const [rawVouchers, setRawVouchers] = useState<ImportVoucher[]>([]);
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
    return subscribeToMergedQueries<ImportVoucher>({
      queries: buildFacilityScopedQueries({
        db,
        collectionName: "import_vouchers",
        facilityField: "warehouse_id",
        scope: facilityScope,
        constraints: [where("is_deleted", "==", false)],
      }),
      mapDocument: (document) => ({
        id: document.id,
        ...document.data(),
      }) as ImportVoucher,
      onData: (vouchers) => {
        setRawVouchers(vouchers.sort((left, right) => time(right.created_at) - time(left.created_at)));
        setLoading(false);
      },
      onError: (error) => {
        console.error("[useImportVouchers] onSnapshot error:", error);
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
  return { activeVouchers, completedVouchers, allVouchers: rawVouchers, loading };
}
