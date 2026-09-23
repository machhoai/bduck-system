"use client";

import {
  AttendanceVerificationStrategy,
  type AttendanceLocationInput,
  type AttendanceCheckInContext,
  type AttendanceLateReport,
  type AttendanceLeaveDay,
  type AttendanceLog,
  type CompanyHoliday,
  type WarehouseAttendanceExemption,
  type WarehouseAttendancePolicy,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import {
  readAttendanceSnapshot,
  writeAttendanceSnapshot,
} from "@/lib/attendanceSnapshotCache";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { useUserStore } from "@/stores/useUserStore";
import { createDetailedApiError } from "@/utils/apiError";
import { getFacilityPermissionScope } from "@/utils/facilityPermissionScope";

export {
  useAllAttendanceExemptions,
  useAttendanceLateReports,
  useAttendanceLogs,
} from "./useAttendanceRecords";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";
const PENDING_CHECK_IN_KEY = "bduck.attendance.pending-check-in.v1";

export async function callAttendanceApi<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: options.body
      ? { "Content-Type": "application/json", ...(options.headers || {}) }
      : options.headers,
    ...options,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, "Khong the xu ly cham cong.");
  }
  return body.data as T;
}

const captureAttendanceLocation = (): Promise<AttendanceLocationInput> => {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.reject(
      new Error("Thiết bị hoặc trình duyệt không hỗ trợ định vị GPS."),
    );
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy_m: position.coords.accuracy,
          captured_at: new Date(position.timestamp).toISOString(),
        }),
      (error) => {
        const message =
          error.code === error.PERMISSION_DENIED
            ? "Bạn cần cho phép truy cập vị trí để chấm công."
            : "Không lấy được vị trí chính xác. Hãy bật GPS và thử lại.";
        reject(new Error(message));
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
    );
  });
};

export function useAttendanceContext() {
  const currentUserId = useUserStore((state) => state.user?.id);
  const [context, setContext] = useState<AttendanceCheckInContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const contextRef = useRef<AttendanceCheckInContext | null>(null);

  const reload = useCallback(
    async (signal?: AbortSignal) => {
      if (!contextRef.current) setLoading(true);
      try {
        const data = await callAttendanceApi<AttendanceCheckInContext>(
          "/api/attendance/context",
          {
            method: "GET",
            signal,
          },
        );
        if (signal?.aborted) return;
        contextRef.current = data;
        setContext(data);
        setError(null);
        if (currentUserId) {
          void writeAttendanceSnapshot(currentUserId, data).catch(
            (cacheError) => {
              console.warn(
                "[useAttendanceContext] cache write failed:",
                cacheError,
              );
            },
          );
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          return;
        }
        console.error("[useAttendanceContext] error:", err);
        if (!contextRef.current) {
          setContext(null);
          setError(
            err instanceof Error ? err.message : "Khong the tai cham cong.",
          );
        }
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [currentUserId],
  );

  useEffect(() => {
    const controller = new AbortController();
    let disposed = false;

    contextRef.current = null;
    setContext(null);
    setLoading(true);
    setError(null);

    const restoreThenRevalidate = async () => {
      if (currentUserId) {
        const cached = await readAttendanceSnapshot(currentUserId);
        if (disposed) return;
        if (cached) {
          contextRef.current = cached;
          setContext(cached);
          setLoading(false);
        }
      }
      await reload(controller.signal);
    };

    void restoreThenRevalidate();
    const unsubscribe = subscribeDataMutation(
      [
        "attendance_late_reports",
        "attendance_logs",
        "warehouse_attendance_policies",
        "warehouse_attendance_exemptions",
        "attendance_work_arrangements",
      ],
      () => void reload(),
    );
    return () => {
      disposed = true;
      controller.abort();
      unsubscribe();
    };
  }, [currentUserId, reload]);

  useEffect(() => {
    const flushPendingCheckIn = async () => {
      const pending =
        typeof window === "undefined"
          ? null
          : window.localStorage.getItem(PENDING_CHECK_IN_KEY);
      if (!pending || !context?.can_check_in || context.today_success_log)
        return;
      try {
        const parsed = JSON.parse(pending) as {
          version: 1;
          action_time: string;
        };
        if (parsed.version !== 1) return;
        const shouldCaptureLocation = Boolean(
          context.active_work_arrangement ||
          context.location_required ||
          context.verification_strategy ===
            AttendanceVerificationStrategy.GPS_ONLY ||
          context.verification_strategy ===
            AttendanceVerificationStrategy.IP_AND_GPS,
        );
        const location = shouldCaptureLocation
          ? await captureAttendanceLocation()
          : undefined;
        await callAttendanceApi<AttendanceLog>("/api/attendance/check-in", {
          method: "POST",
          body: JSON.stringify({
            action_time: parsed.action_time,
            location,
          }),
        });
        window.localStorage.removeItem(PENDING_CHECK_IN_KEY);
        emitDataMutation(["attendance_logs", "audit_logs"]);
        await reload();
      } catch (pendingError) {
        console.error(
          "[useAttendanceContext] pending check-in error:",
          pendingError,
        );
      }
    };
    window.addEventListener("online", flushPendingCheckIn);
    if (navigator.onLine) void flushPendingCheckIn();
    return () => window.removeEventListener("online", flushPendingCheckIn);
  }, [context, reload]);

  const checkIn = useCallback(async () => {
    const shouldCaptureLocation = Boolean(
      context?.active_work_arrangement ||
      context?.location_required ||
      context?.verification_strategy ===
        AttendanceVerificationStrategy.GPS_ONLY ||
      context?.verification_strategy ===
        AttendanceVerificationStrategy.IP_AND_GPS,
    );
    const location = shouldCaptureLocation
      ? await captureAttendanceLocation()
      : undefined;
    const actionTime = new Date().toISOString();
    try {
      const log = await callAttendanceApi<AttendanceLog>(
        "/api/attendance/check-in",
        {
          method: "POST",
          body: JSON.stringify({
            action_time: actionTime,
            location,
          }),
        },
      );
      emitDataMutation(["attendance_logs", "audit_logs"]);
      await reload();
      return log;
    } catch (checkInError) {
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        window.localStorage.setItem(
          PENDING_CHECK_IN_KEY,
          JSON.stringify({ version: 1, action_time: actionTime }),
        );
        throw new Error(
          "Đang mất kết nối. Lần check-in đã được lưu trên thiết bị và sẽ tự đồng bộ khi có mạng.",
        );
      }
      throw checkInError;
    }
  }, [context, reload]);

  const reportLate = useCallback(
    async (payload: {
      attendance_date?: string;
      expected_arrival_time?: string | null;
      estimated_arrival_time?: string | null;
      reason: string;
    }) => {
      const report = await callAttendanceApi<AttendanceLateReport>(
        "/api/attendance/late-reports",
        {
          method: "POST",
          body: JSON.stringify({
            ...payload,
            action_time: new Date().toISOString(),
          }),
        },
      );
      emitDataMutation(["attendance_late_reports", "audit_logs"]);
      return report;
    },
    [],
  );

  return { context, loading, error, reload, checkIn, reportLate };
}

export function useAttendanceLeaveDays(dateFrom: string, dateTo: string) {
  const [leaveDays, setLeaveDays] = useState<AttendanceLeaveDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!dateFrom || !dateTo) {
        setLeaveDays([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await callAttendanceApi<AttendanceLeaveDay[]>(
          `/api/attendance/leave-days?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`,
          { method: "GET", signal },
        );
        if (!signal?.aborted) {
          setLeaveDays(data);
          setError(null);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("[useAttendanceLeaveDays] error:", error);
        if (!signal?.aborted) {
          setLeaveDays([]);
          setError("Không thể tải dữ liệu nghỉ phép.");
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [dateFrom, dateTo],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const unsubscribe = subscribeDataMutation(
      ["leave_requests", "leave_import_rows"],
      () => void load(controller.signal),
    );
    const refreshTimer = window.setInterval(
      () => void load(controller.signal),
      60_000,
    );
    return () => {
      controller.abort();
      unsubscribe();
      window.clearInterval(refreshTimer);
    };
  }, [load]);

  return { leaveDays, loading, error };
}

export function useAttendanceHolidays(dateFrom: string, dateTo: string) {
  const [holidays, setHolidays] = useState<CompanyHoliday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!dateFrom || !dateTo) {
        setHolidays([]);
        setError(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await callAttendanceApi<CompanyHoliday[]>(
          `/api/attendance/holidays?date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`,
          { method: "GET", signal },
        );
        if (!signal?.aborted) {
          setHolidays(data);
          setError(null);
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        console.error("[useAttendanceHolidays] error:", error);
        if (!signal?.aborted) {
          setHolidays([]);
          setError("Không thể tải ngày nghỉ công ty.");
        }
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [dateFrom, dateTo],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    const unsubscribe = subscribeDataMutation(["company_holidays"], () =>
      void load(controller.signal),
    );
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [load]);

  return { holidays, loading, error };
}

export function useAttendancePolicies() {
  const permissions = useUserStore((state) => state.permissions);
  const facilityScope = useMemo(
    () =>
      getFacilityPermissionScope(permissions, [
        "attendance.view",
        "attendance.check_in",
        "attendance.config",
      ]),
    [permissions],
  );
  const [policies, setPolicies] = useState<WarehouseAttendancePolicy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | undefined;
    let disposed = false;

    const loadFallback = async () => {
      try {
        const data = await callAttendanceApi<WarehouseAttendancePolicy[]>(
          "/api/attendance/policies",
          {
            method: "GET",
          },
        );
        if (!disposed) setPolicies(data);
      } catch (err) {
        console.error("[useAttendancePolicies] fallback error:", err);
        if (!disposed) setPolicies([]);
      } finally {
        if (!disposed) setLoading(false);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeSnapshot?.();
      if (!user) {
        void loadFallback();
        return;
      }

      unsubscribeSnapshot = subscribeToMergedQueries<WarehouseAttendancePolicy>(
        {
          queries: buildFacilityScopedQueries({
            db,
            collectionName: "warehouse_attendance_policies",
            facilityField: "warehouse_id",
            scope: facilityScope,
            constraints: [where("effective_to", "==", null)],
          }),
          mapDocument: (document) =>
            ({
              ...document.data(),
              id: document.id,
            }) as WarehouseAttendancePolicy,
          onData: (data) => {
            if (disposed) return;
            setPolicies(data);
            setLoading(false);
          },
          onError: () => void loadFallback(),
        },
      );
    });

    return () => {
      disposed = true;
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, [facilityScope]);

  const updatePolicy = useCallback(
    async (warehouseId: string, payload: AttendancePolicyUpdate) => {
      const result = await callAttendanceApi<WarehouseAttendancePolicy>(
        `/api/attendance/policies/${warehouseId}`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        },
      );
      emitDataMutation(["warehouse_attendance_policies", "audit_logs"]);
      return result;
    },
    [],
  );

  const policyByWarehouse = useMemo(
    () => new Map(policies.map((policy) => [policy.warehouse_id, policy])),
    [policies],
  );

  return { policies, policyByWarehouse, loading, updatePolicy };
}

export type AttendancePolicyUpdate = Pick<
  WarehouseAttendancePolicy,
  | "enabled"
  | "ip_addresses"
  | "verification_strategy"
  | "gps_radius_m"
  | "gps_max_accuracy_m"
  | "gps_max_age_seconds"
  | "allow_business_trip"
  | "allow_work_from_home"
>;

export function useAttendanceExemptions(warehouseId?: string | null) {
  const [exemptions, setExemptions] = useState<WarehouseAttendanceExemption[]>(
    [],
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!warehouseId) {
      setExemptions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const exemptionsQuery = query(
      collection(db, "warehouse_attendance_exemptions"),
      where("warehouse_id", "==", warehouseId),
      where("effective_to", "==", null),
    );
    const unsubscribe = onSnapshot(
      exemptionsQuery,
      (snapshot) => {
        setExemptions(
          snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as WarehouseAttendanceExemption[],
        );
        setLoading(false);
      },
      (err) => {
        console.error("[useAttendanceExemptions] snapshot error:", err);
        setExemptions([]);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [warehouseId]);

  const updateExemptions = useCallback(
    async (nextWarehouseId: string, excludedUserIds: string[]) => {
      const result = await callAttendanceApi<WarehouseAttendanceExemption[]>(
        `/api/attendance/exemptions/${nextWarehouseId}`,
        {
          method: "PUT",
          body: JSON.stringify({ excluded_user_ids: excludedUserIds }),
        },
      );
      emitDataMutation(["warehouse_attendance_exemptions", "audit_logs"]);
      return result;
    },
    [],
  );

  return { exemptions, loading, updateExemptions };
}
