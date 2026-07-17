"use client";

import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import type { OfficeScopeHistoryEntry } from "@bduck/shared-types";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function fetchOfficeScopeHistory(
  officeId: string,
  signal?: AbortSignal,
): Promise<OfficeScopeHistoryEntry[]> {
  const response = await fetch(
    `${API_BASE_URL}/api/office-scopes/${officeId}/history?limit=20`,
    { credentials: "include", signal },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(
      response,
      body,
      "Khong the tai lich su pham vi van phong.",
    );
  }
  return Array.isArray(body.data) ? body.data : [];
}

async function retryOfficeScopeMaterialization(
  officeId: string,
  revision: number,
) {
  const response = await fetch(
    `${API_BASE_URL}/api/office-scopes/${officeId}/materializations/${revision}/retry`,
    { method: "POST", credentials: "include" },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(
      response,
      body,
      "Khong the thu lai viec ap dung quyen.",
    );
  }
  emitDataMutation(["office_scope_materializations", "audit_logs"]);
  return body.data;
}

export function useOfficeScopeHistory(officeId?: string | null) {
  const [entries, setEntries] = useState<OfficeScopeHistoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(officeId));
  const [hasError, setHasError] = useState(false);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!officeId) {
        setEntries([]);
        setIsLoading(false);
        return;
      }
      try {
        setEntries(await fetchOfficeScopeHistory(officeId, signal));
        setHasError(false);
      } catch (loadError) {
        if (signal?.aborted) return;
        console.error("[useOfficeScopeHistory] load error:", loadError);
        setHasError(true);
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [officeId],
  );

  useEffect(() => {
    const controller = new AbortController();
    let unsubscribeConfig: (() => void) | undefined;
    let unsubscribeMaterializations: (() => void) | undefined;
    setIsLoading(Boolean(officeId));
    void load(controller.signal);
    const unsubscribeMutation = subscribeDataMutation(
      ["office_scope_configs", "office_scope_materializations", "audit_logs"],
      () => void load(controller.signal),
    );
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeConfig?.();
      unsubscribeMaterializations?.();
      if (!user || !officeId) return;
      unsubscribeConfig = onSnapshot(
        doc(db, "office_scope_configs", officeId),
        () => void load(controller.signal),
        (snapshotError) =>
          console.warn(
            "[useOfficeScopeHistory] realtime fallback:",
            snapshotError,
          ),
      );
      unsubscribeMaterializations = onSnapshot(
        query(
          collection(db, "office_scope_materializations"),
          where("office_id", "==", officeId),
        ),
        () => void load(controller.signal),
        (snapshotError) =>
          console.warn(
            "[useOfficeScopeHistory] materialization fallback:",
            snapshotError,
          ),
      );
    });
    return () => {
      controller.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      unsubscribeConfig?.();
      unsubscribeMaterializations?.();
    };
  }, [load, officeId]);

  const retryMaterialization = useCallback(
    async (revision: number) => {
      if (!officeId) throw new Error("OFFICE_ID_REQUIRED");
      const result = await retryOfficeScopeMaterialization(officeId, revision);
      await load();
      return result;
    },
    [load, officeId],
  );

  return { entries, isLoading, hasError, retryMaterialization };
}
