"use client";

import type {
  AttendanceLateReport,
  AttendanceLog,
  WarehouseAttendanceExemption,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import { where, type QueryConstraint } from "firebase/firestore";
import { useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { useUserStore } from "@/stores/useUserStore";
import { getFacilityPermissionScope } from "@/utils/facilityPermissionScope";

function useScopedAttendanceRecords<T>({
  collectionName,
  constraints,
}: {
  collectionName: "attendance_logs" | "attendance_late_reports";
  constraints: QueryConstraint[];
}) {
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () => getFacilityPermissionScope(permissions, ["attendance.view"]),
    [permissions],
  );
  const [records, setRecords] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    let unsubscribeSnapshot: (() => void) | undefined;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeSnapshot?.();
      if (!user) {
        setRecords([]);
        setError(null);
        setLoading(false);
        return;
      }
      unsubscribeSnapshot = subscribeToMergedQueries<T>({
        queries: buildFacilityScopedQueries({
          db,
          collectionName,
          facilityField: "warehouse_id",
          scope: facilityScope,
          constraints,
        }),
        mapDocument: (document) =>
          ({
            ...document.data(),
            id: document.id,
          }) as T,
        onData: (data) => {
          setRecords(data);
          setError(null);
          setLoading(false);
        },
        onError: (error) => {
          console.error(`[${collectionName}] snapshot error:`, error);
          setRecords([]);
          setError("Không thể tải dữ liệu chấm công.");
          setLoading(false);
        },
      });
    });
    return () => {
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, [collectionName, constraints, facilityScope]);

  return { records, loading, error };
}

export function useAttendanceLogs(dateFrom: string, dateTo: string) {
  const constraints = useMemo(
    () => [
      where("attendance_date", ">=", dateFrom),
      where("attendance_date", "<=", dateTo),
    ],
    [dateFrom, dateTo],
  );
  const { records, loading, error } = useScopedAttendanceRecords<AttendanceLog>({
    collectionName: "attendance_logs",
    constraints,
  });
  return { logs: records, loading, error };
}

export function useAttendanceLateReports(dateFrom: string, dateTo: string) {
  const constraints = useMemo(
    () => [
      where("attendance_date", ">=", dateFrom),
      where("attendance_date", "<=", dateTo),
    ],
    [dateFrom, dateTo],
  );
  const { records, loading, error } = useScopedAttendanceRecords<AttendanceLateReport>(
    {
      collectionName: "attendance_late_reports",
      constraints,
    },
  );
  return { reports: records, loading, error };
}

export function useAllAttendanceExemptions() {
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () =>
      getFacilityPermissionScope(permissions, [
        "attendance.view",
        "attendance.config",
      ]),
    [permissions],
  );
  const [exemptions, setExemptions] = useState<WarehouseAttendanceExemption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToMergedQueries<WarehouseAttendanceExemption>({
      queries: buildFacilityScopedQueries({
        db,
        collectionName: "warehouse_attendance_exemptions",
        facilityField: "warehouse_id",
        scope: facilityScope,
        constraints: [where("effective_to", "==", null)],
      }),
      mapDocument: (document) =>
        ({
          ...document.data(),
          id: document.id,
        }) as WarehouseAttendanceExemption,
      onData: (data) => {
        setExemptions(data);
        setLoading(false);
      },
      onError: (error) => {
        console.error("[useAllAttendanceExemptions] snapshot error:", error);
        setExemptions([]);
        setLoading(false);
      },
    });
    return unsubscribe;
  }, [facilityScope]);

  return { exemptions, loading };
}
