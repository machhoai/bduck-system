"use client";

import type { AttendanceWorkArrangement } from "@bduck/shared-types";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import { callAttendanceApi } from "./useAttendance";
import { db } from "@/lib/firebase";
import { emitDataMutation } from "@/lib/dataInvalidation";

export type AttendanceWorkArrangementPayload = Omit<
  AttendanceWorkArrangement,
  | "id"
  | "warehouse_id"
  | "employee_profile_id"
  | "employee_id"
  | "employee_name"
  | "status"
  | "requested_by"
  | "approved_by"
  | "approved_at"
  | "cancelled_by"
  | "cancelled_at"
  | "created_at"
  | "updated_at"
  | "is_deleted"
>;

export function useAttendanceWorkArrangements(
  warehouseId?: string | null,
) {
  const [arrangements, setArrangements] = useState<
    AttendanceWorkArrangement[]
  >([]);
  const [loading, setLoading] = useState(false);

  const loadFallback = useCallback(async () => {
    if (!warehouseId) return;
    try {
      setArrangements(
        await callAttendanceApi<AttendanceWorkArrangement[]>(
          `/api/attendance/work-arrangements/${warehouseId}`,
        ),
      );
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    if (!warehouseId) {
      setArrangements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    return onSnapshot(
      query(
        collection(db, "attendance_work_arrangements"),
        where("warehouse_id", "==", warehouseId),
      ),
      (snapshot) => {
        setArrangements(
          snapshot.docs
            .map(
              (document) =>
                ({
                  ...document.data(),
                  id: document.id,
                }) as AttendanceWorkArrangement,
            )
            .filter((item) => !item.is_deleted)
            .sort((a, b) => b.start_date.localeCompare(a.start_date)),
        );
        setLoading(false);
      },
      (error) => {
        console.error("[useAttendanceWorkArrangements] snapshot error:", error);
        void loadFallback();
      },
    );
  }, [loadFallback, warehouseId]);

  const approve = useCallback(
    async (payload: AttendanceWorkArrangementPayload) => {
      if (!warehouseId) throw new Error("Chưa chọn cơ sở.");
      const result = await callAttendanceApi<AttendanceWorkArrangement>(
        `/api/attendance/work-arrangements/${warehouseId}`,
        { method: "POST", body: JSON.stringify(payload) },
      );
      emitDataMutation(["attendance_work_arrangements", "audit_logs"]);
      return result;
    },
    [warehouseId],
  );

  const cancel = useCallback(
    async (arrangementId: string) => {
      if (!warehouseId) throw new Error("Chưa chọn cơ sở.");
      const result = await callAttendanceApi<AttendanceWorkArrangement>(
        `/api/attendance/work-arrangements/${warehouseId}/${arrangementId}/cancel`,
        { method: "PATCH" },
      );
      emitDataMutation(["attendance_work_arrangements", "audit_logs"]);
      return result;
    },
    [warehouseId],
  );

  return { arrangements, loading, approve, cancel };
}
