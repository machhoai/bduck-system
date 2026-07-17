"use client";

import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { where } from "firebase/firestore";
import type {
  NonconformityReport,
  NonconformityStatus,
  ResolutionType,
} from "@bduck/shared-types";
import { auth, db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { emitDataMutation, subscribeDataMutation } from "@/lib/dataInvalidation";
import { useUserStore } from "@/stores/useUserStore";
import { createDetailedApiError } from "@/utils/apiError";
import { getFacilityPermissionScope } from "@/utils/facilityPermissionScope";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

type ResolvePayload = {
  resolution_type: ResolutionType;
  resolution_notes?: string | null;
  otp: string;
  action_time: string;
};

type ApiResponse<T> = {
  success?: boolean;
  data?: T;
  messages?: { vi?: string; zh?: string };
};

function toTime(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && value !== null) {
    const timestamp = value as {
      toDate?: () => Date;
      seconds?: number;
      _seconds?: number;
    };
    if (typeof timestamp.toDate === "function") return timestamp.toDate().getTime();
    if (typeof timestamp.seconds === "number") return timestamp.seconds * 1000;
    if (typeof timestamp._seconds === "number") return timestamp._seconds * 1000;
  }
  const parsed = new Date(value as string | number).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

async function fetchReportsFromApi(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/nonconformities`, {
    method: "GET",
    credentials: "include",
    signal,
  });
  const body = (await response.json().catch(() => null)) as
    | ApiResponse<NonconformityReport[]>
    | null;

  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, "Khong the tai bao cao ngoai le.");
  }

  return body.data || [];
}

export function isActionableNonconformity(status: NonconformityStatus | string) {
  return status !== "RESOLVED" && status !== "CLOSED";
}

export function countActionableNonconformities(reports: NonconformityReport[]) {
  return reports.filter((report) => isActionableNonconformity(report.status)).length;
}

export function useNonconformities(options: { enabled?: boolean } = {}) {
  const enabled = options.enabled ?? true;
  const permissions = useUserStore((state) => state.permissions);
  const [reports, setReports] = useState<NonconformityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const facilityScope = useMemo(
    () =>
      getFacilityPermissionScope(permissions, [
        "inventory.read",
        "inventory.write",
      ]),
    [permissions],
  );

  useEffect(() => {
    if (!enabled) {
      setReports([]);
      setLoading(false);
      setError(null);
      return;
    }

    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const applyRecords = (records: NonconformityReport[]) => {
      setReports(
        records
          .filter((report) => report.is_deleted !== true)
          .sort((a, b) => toTime(b.created_at) - toTime(a.created_at)),
      );
    };

    const loadApiFallback = async () => {
      try {
        const data = await fetchReportsFromApi(abortController.signal);
        if (isDisposed) return;
        applyRecords(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        const nextError =
          apiError instanceof Error
            ? apiError
            : new Error("Khong the tai bao cao ngoai le.");
        console.error("[useNonconformities] API fallback error:", apiError);
        setReports([]);
        setError(nextError);
      } finally {
        if (!isDisposed) setLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation(
      ["nonconformity_reports", "quarantine_records"],
      () => void loadApiFallback(),
    );

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (!user) {
        void loadApiFallback();
        return;
      }

      unsubscribeSnapshot = subscribeToMergedQueries<NonconformityReport>({
        queries: buildFacilityScopedQueries({
          db,
          collectionName: "nonconformity_reports",
          facilityField: "warehouse_id",
          scope: facilityScope,
          constraints: [where("is_deleted", "==", false)],
        }),
        mapDocument: (document) => ({
          ...document.data(),
          id: document.id,
        }) as NonconformityReport,
        onData: (data) => {
          if (isDisposed) return;
          applyRecords(data);
          setLoading(false);
          setError(null);
        },
        onError: (snapshotError) => {
          console.warn("[useNonconformities] onSnapshot error:", snapshotError);
          void loadApiFallback();
        },
      });
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [enabled, facilityScope]);

  return { reports, loading, error };
}

export async function resolveNonconformityReport(
  id: string,
  payload: ResolvePayload,
) {
  const response = await fetch(`${API_BASE_URL}/api/nonconformities/${id}/resolve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => null)) as ApiResponse<null> | null;

  if (!response.ok || !body?.success) {
    throw createDetailedApiError(response, body, "Khong the xu ly bao cao ngoai le.");
  }

  emitDataMutation([
    "nonconformity_reports",
    "quarantine_records",
    "inventory",
    "audit_logs",
  ]);
}
