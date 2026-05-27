"use client";

import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { useEffect, useState } from "react";
import type { AuditLog } from "@bduck/shared-types";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { auth, db } from "@/lib/firebase";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

async function fetchAuditLogsFromApi(signal?: AbortSignal) {
  const response = await fetch(`${API_BASE_URL}/api/audit-logs?limit=500`, {
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

export function useAuditLogs() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let unsubscribeSnapshot: (() => void) | undefined;
    let isDisposed = false;

    const loadApiFallback = async () => {
      try {
        const data = await fetchAuditLogsFromApi(abortController.signal);
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

      const auditQuery = query(
        collection(db, "audit_logs"),
        orderBy("sync_time", "desc"),
        limit(500),
      );

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
  }, []);

  return { logs, isLoading, error };
}
