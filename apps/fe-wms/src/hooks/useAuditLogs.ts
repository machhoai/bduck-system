"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import type { AuditLog } from "@bduck/shared-types";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";
import { useUserStore } from "@/stores/useUserStore";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface UseAuditLogsOptions {
  warehouseId?: string;
  limit?: number;
}

async function fetchAuditLogsFromApi(
  params: UseAuditLogsOptions,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams({
    limit: String(params.limit || 500),
  });

  if (params.warehouseId) {
    searchParams.set("warehouse_id", params.warehouseId);
  }

  const response = await fetch(`${API_BASE_URL}/api/audit-logs?${searchParams}`, {
    method: "GET",
    credentials: "include",
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.messages?.vi || "Không thể tải audit log.");
  }

  const body = await response.json();
  return (body.data || []) as AuditLog[];
}

/**
 * Extract warehouse IDs the current user has audit.read access for.
 * Returns undefined if user has global access (no Firestore filtering needed).
 */
function extractAllowedWarehouseIds(
  permissions: Record<string, Record<string, unknown>>,
): string[] | undefined {
  const globalPerms = permissions["global"] || {};
  if (globalPerms["*"] === true || globalPerms["audit.read"] === true) {
    return undefined; // Unrestricted
  }

  const ids: string[] = [];
  for (const [scope, scopePerms] of Object.entries(permissions)) {
    if (scope === "global") continue;
    if (scopePerms["*"] === true || scopePerms["audit.read"] === true) {
      ids.push(scope);
    }
  }
  return ids;
}

export function useAuditLogs(options: UseAuditLogsOptions = {}) {
  const { warehouseId, limit: logLimit = 500 } = options;
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const permissions = useUserStore((s) => s.permissions);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    setIsLoading(true);
    setError(null);

    const loadApiFallback = async () => {
      try {
        const data = await fetchAuditLogsFromApi(
          { warehouseId, limit: logLimit },
          abortController.signal,
        );
        if (isDisposed) return;
        setLogs(data);
        setError(null);
      } catch (apiError) {
        if (isDisposed) return;
        console.error("[useAuditLogs] API fallback error:", apiError);
        setLogs([]);
        setError(
          apiError instanceof Error ? apiError.message : "Không thể tải audit log.",
        );
      } finally {
        if (!isDisposed) setIsLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation("audit_logs", () => {
      void loadApiFallback();
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = undefined;
      }

      if (!user) {
        void loadApiFallback();
        return;
      }

      // RBAC: scope the Firestore query by allowed warehouse IDs
      const allowedIds = extractAllowedWarehouseIds(permissions);

      if (
        warehouseId &&
        allowedIds !== undefined &&
        !allowedIds.includes(warehouseId)
      ) {
        setLogs([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      // If user has no warehouse-scoped audit access at all, use API (it handles RBAC too)
      if (!warehouseId && allowedIds !== undefined && allowedIds.length === 0) {
        setLogs([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      // Build Firestore query with optional warehouse scoping
      // Note: Firestore `in` supports max 30 values
      let auditQuery;
      if (warehouseId) {
        auditQuery = query(
          collection(db, "audit_logs"),
          where("warehouse_id", "==", warehouseId),
          orderBy("sync_time", "desc"),
          limit(logLimit),
        );
      } else if (allowedIds !== undefined && allowedIds.length > 0) {
        const scopedIds = allowedIds.slice(0, 30);
        auditQuery = query(
          collection(db, "audit_logs"),
          where("warehouse_id", "in", scopedIds),
          orderBy("sync_time", "desc"),
          limit(logLimit),
        );
      } else {
        auditQuery = query(
          collection(db, "audit_logs"),
          orderBy("sync_time", "desc"),
          limit(logLimit),
        );
      }

      unsubscribeSnapshot = onSnapshot(
        auditQuery,
        (snapshot) => {
          if (isDisposed) return;
          const data = snapshot.docs.map((doc) => ({
            ...doc.data(),
            id: doc.id,
          })) as AuditLog[];
          setLogs(data);
          setIsLoading(false);
          setError(null);
        },
        () => void loadApiFallback(),
      );
    });

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeMutation();
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, [permissions, warehouseId, logLimit]);

  return { logs, isLoading, error };
}
