"use client";

import { onAuthStateChanged } from "firebase/auth";
import { documentId, where } from "firebase/firestore";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { OfficeScopeOverviewItem } from "@bduck/shared-types";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import {
  buildFacilityScopedQueries,
  subscribeToMergedQueries,
} from "@/lib/scopedFirestore";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function fetchOfficeScopeOverview(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/office-scopes`, {
    credentials: "include",
    signal,
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(
      response,
      body,
      "Không thể tải danh sách phạm vi văn phòng.",
    );
  }
  return body.data as OfficeScopeOverviewItem[];
}

export function useOfficeScopeOverview(officeIds: readonly string[]) {
  const officeIdsKey = useMemo(
    () => [...new Set(officeIds)].filter(Boolean).sort().join("|"),
    [officeIds],
  );
  const normalizedIds = useMemo(
    () => (officeIdsKey ? officeIdsKey.split("|") : []),
    [officeIdsKey],
  );
  const [items, setItems] = useState<OfficeScopeOverviewItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const data = await fetchOfficeScopeOverview(signal);
      setItems(data);
      setError(null);
    } catch (loadError) {
      if (signal?.aborted) return;
      console.error("[useOfficeScopeOverview] load error:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải danh sách phạm vi văn phòng.",
      );
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const unsubscribes: Array<() => void> = [];
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => void refresh(controller.signal), 50);
    };
    const unsubscribeMutation = subscribeDataMutation(
      [
        "office_scope_configs",
        "office_scope_edges",
        "employee_profiles",
        "warehouses",
      ],
      scheduleRefresh,
    );
    void refresh(controller.signal);

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribes.splice(0).forEach((unsubscribe) => unsubscribe());
      if (!user || normalizedIds.length === 0) return;

      const scope = { isSystemAdmin: false, facilityIds: normalizedIds };
      const subscribe = (
        collectionName: string,
        facilityField: string | ReturnType<typeof documentId>,
        constraints = [] as ReturnType<typeof where>[],
      ) =>
        subscribeToMergedQueries<string>({
          queries: buildFacilityScopedQueries({
            db,
            collectionName,
            facilityField,
            scope,
            constraints,
          }),
          mapDocument: (snapshot) => snapshot.id,
          onData: scheduleRefresh,
          onError: (snapshotError) =>
            console.warn(
              `[useOfficeScopeOverview] ${collectionName} listener fallback:`,
              snapshotError,
            ),
        });

      unsubscribes.push(
        subscribe("office_scope_configs", documentId()),
        subscribe("office_scope_edges", "office_id"),
        subscribe("employee_profiles", "workplace_warehouse_id", [
          where("is_deleted", "==", false),
        ]),
      );
    });

    return () => {
      controller.abort();
      if (refreshTimer) clearTimeout(refreshTimer);
      unsubscribeMutation();
      unsubscribeAuth();
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [officeIdsKey, refresh]);

  return { items, isLoading, error, refresh };
}
