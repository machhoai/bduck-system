"use client";

import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import type {
  OfficeScopeSnapshot,
  OfficeScopeCeilingUpdateRequest,
  OfficeScopeUpdateRequest,
} from "@bduck/shared-types";
import {
  emitDataMutation,
  subscribeDataMutation,
} from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function callOfficeScopeApi(
  officeId: string,
  method: "GET" | "PUT",
  payload?: OfficeScopeUpdateRequest | OfficeScopeCeilingUpdateRequest,
  signal?: AbortSignal,
  suffix = "",
) {
  const response = await fetch(
    `${API_BASE_URL}/api/office-scopes/${officeId}${suffix}`,
    {
      method,
      credentials: "include",
      signal,
      headers: payload ? { "Content-Type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    },
  );
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success) {
    throw createDetailedApiError(
      response,
      body,
      "Khong the tai pham vi van phong.",
    );
  }
  return body.data as OfficeScopeSnapshot;
}

export function useOfficeScope(officeId?: string | null) {
  const [scope, setScope] = useState<OfficeScopeSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(officeId));
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (!officeId) {
        setScope(null);
        setIsLoading(false);
        return null;
      }
      try {
        const data = await callOfficeScopeApi(
          officeId,
          "GET",
          undefined,
          signal,
        );
        setScope(data);
        setError(null);
        return data;
      } catch (loadError) {
        if (signal?.aborted) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Khong the tai pham vi.",
        );
        return null;
      } finally {
        if (!signal?.aborted) setIsLoading(false);
      }
    },
    [officeId],
  );

  useEffect(() => {
    const controller = new AbortController();
    let unsubscribeConfig: (() => void) | undefined;
    let unsubscribeCeiling: (() => void) | undefined;
    let unsubscribeEdges: (() => void) | undefined;
    const unsubscribeMutation = subscribeDataMutation(
      ["office_scope_configs", "office_scope_ceilings", "office_scope_edges"],
      () => void refresh(controller.signal),
    );
    setIsLoading(Boolean(officeId));
    void refresh(controller.signal);
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubscribeConfig?.();
      unsubscribeCeiling?.();
      unsubscribeEdges?.();
      if (!user || !officeId) return;
      const onRealtimeChange = () => void refresh(controller.signal);
      const onRealtimeError = (snapshotError: unknown) =>
        console.warn("[useOfficeScope] realtime fallback:", snapshotError);
      unsubscribeConfig = onSnapshot(
        doc(db, "office_scope_configs", officeId),
        onRealtimeChange,
        onRealtimeError,
      );
      unsubscribeEdges = onSnapshot(
        query(
          collection(db, "office_scope_edges"),
          where("office_id", "==", officeId),
        ),
        onRealtimeChange,
        onRealtimeError,
      );
      unsubscribeCeiling = onSnapshot(
        doc(db, "office_scope_ceilings", officeId),
        onRealtimeChange,
        onRealtimeError,
      );
    });
    return () => {
      controller.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      unsubscribeConfig?.();
      unsubscribeCeiling?.();
      unsubscribeEdges?.();
    };
  }, [officeId, refresh]);

  const updateScope = useCallback(
    async (payload: OfficeScopeUpdateRequest) => {
      if (!officeId) throw new Error("OFFICE_ID_REQUIRED");
      const data = await callOfficeScopeApi(officeId, "PUT", payload);
      setScope(data);
      emitDataMutation([
        "office_scope_configs",
        "office_scope_edges",
        "user_access",
        "audit_logs",
      ]);
      return data;
    },
    [officeId],
  );

  const updateCeiling = useCallback(
    async (payload: OfficeScopeCeilingUpdateRequest) => {
      if (!officeId) throw new Error("OFFICE_ID_REQUIRED");
      const data = await callOfficeScopeApi(
        officeId,
        "PUT",
        payload,
        undefined,
        "/ceiling",
      );
      setScope(data);
      emitDataMutation(["office_scope_ceilings", "audit_logs"]);
      return data;
    },
    [officeId],
  );

  return {
    scope,
    isLoading,
    error,
    refresh,
    updateScope,
    updateCeiling,
  };
}
