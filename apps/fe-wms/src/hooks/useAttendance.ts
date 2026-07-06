"use client";

import type {
  AttendanceCheckInContext,
  AttendanceLog,
  WarehouseAttendanceExemption,
  WarehouseAttendancePolicy,
} from "@bduck/shared-types";
import { onAuthStateChanged } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import { auth, db } from "@/lib/firebase";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function callAttendanceApi<T>(
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

export function useAttendanceContext() {
  const [context, setContext] = useState<AttendanceCheckInContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const data = await callAttendanceApi<AttendanceCheckInContext>(
        "/api/attendance/context",
        {
          method: "GET",
          signal,
        },
      );
      if (signal?.aborted) return;
      setContext(data);
      setError(null);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      console.error("[useAttendanceContext] error:", err);
      setContext(null);
      setError(err instanceof Error ? err.message : "Khong the tai cham cong.");
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    const unsubscribe = subscribeDataMutation(
      [
        "attendance_logs",
        "warehouse_attendance_policies",
        "warehouse_attendance_exemptions",
      ],
      () => void reload(),
    );
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [reload]);

  const checkIn = useCallback(async () => {
    const log = await callAttendanceApi<AttendanceLog>(
      "/api/attendance/check-in",
      {
        method: "POST",
        body: JSON.stringify({ action_time: new Date().toISOString() }),
      },
    );
    emitDataMutation(["attendance_logs", "audit_logs"]);
    await reload();
    return log;
  }, [reload]);

  return { context, loading, error, reload, checkIn };
}

export function useAttendancePolicies() {
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

      unsubscribeSnapshot = onSnapshot(
        query(
          collection(db, "warehouse_attendance_policies"),
          where("effective_to", "==", null),
        ),
        (snapshot) => {
          if (disposed) return;
          setPolicies(
            snapshot.docs.map((doc) => ({
              ...doc.data(),
              id: doc.id,
            })) as WarehouseAttendancePolicy[],
          );
          setLoading(false);
        },
        () => void loadFallback(),
      );
    });

    return () => {
      disposed = true;
      unsubscribeAuth();
      unsubscribeSnapshot?.();
    };
  }, []);

  const updatePolicy = useCallback(
    async (
      warehouseId: string,
      payload: { enabled: boolean; ip_addresses: string[] },
    ) => {
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

export function useAllAttendanceExemptions() {
  const [exemptions, setExemptions] = useState<WarehouseAttendanceExemption[]>(
    [],
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const exemptionsQuery = query(
      collection(db, "warehouse_attendance_exemptions"),
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
        console.error("[useAllAttendanceExemptions] snapshot error:", err);
        setExemptions([]);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  return { exemptions, loading };
}

export function useAttendanceLogs(dateFrom: string, dateTo: string) {
  const [logs, setLogs] = useState<AttendanceLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = onSnapshot(
      collection(db, "attendance_logs"),
      (snapshot) => {
        const data = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        })) as AttendanceLog[];
        setLogs(
          data.filter(
            (log) =>
              log.attendance_date >= dateFrom && log.attendance_date <= dateTo,
          ),
        );
        setLoading(false);
      },
      (err) => {
        console.error("[useAttendanceLogs] snapshot error:", err);
        setLogs([]);
        setLoading(false);
      },
    );
    return unsubscribe;
  }, [dateFrom, dateTo]);

  return { logs, loading };
}
