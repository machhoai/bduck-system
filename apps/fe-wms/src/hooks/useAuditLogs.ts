"use client";

import { useEffect, useState } from "react";
import type { AuditLog } from "@bduck/shared-types";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";
const AUDIT_LOG_BATCH_SIZE = 500;

interface UseAuditLogsOptions {
  warehouseId?: string;
  limit?: number;
  page?: number;
}

async function fetchAuditLogsFromApi(
  params: UseAuditLogsOptions,
  signal?: AbortSignal,
) {
  const searchParams = new URLSearchParams({
    limit: String(params.limit || AUDIT_LOG_BATCH_SIZE),
    page: String(params.page || 1),
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
    throw createDetailedApiError(response, errorData, "Khong the tai audit log.");
  }

  const body = await response.json();
  return (body.data || []) as AuditLog[];
}

export function useAuditLogs(options: UseAuditLogsOptions = {}) {
  const { warehouseId, limit: logLimit, page = 1 } = options;
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();
    let isDisposed = false;

    setIsLoading(true);
    setError(null);

    const loadAuditLogs = async () => {
      try {
        const fetchAll = logLimit === undefined;
        const requestedLimit = logLimit ?? AUDIT_LOG_BATCH_SIZE;
        const data: AuditLog[] = [];
        let nextPage = page;

        while (true) {
          const batch = await fetchAuditLogsFromApi(
            { warehouseId, limit: requestedLimit, page: nextPage },
            abortController.signal,
          );

          data.push(...batch);

          if (!fetchAll || batch.length < requestedLimit) {
            break;
          }

          nextPage += 1;
        }

        if (isDisposed) return;
        setLogs(data);
        setError(null);
      } catch (apiError: unknown) {
        if (isDisposed) return;
        if (apiError instanceof DOMException && apiError.name === "AbortError") {
          return;
        }
        console.error("[useAuditLogs] API error:", apiError);
        setLogs([]);
        setError(
          apiError instanceof Error ? apiError.message : "Khong the tai audit log.",
        );
      } finally {
        if (!isDisposed) setIsLoading(false);
      }
    };

    const unsubscribeMutation = subscribeDataMutation("audit_logs", () => {
      void loadAuditLogs();
    });

    void loadAuditLogs();

    return () => {
      isDisposed = true;
      abortController.abort();
      unsubscribeMutation();
    };
  }, [warehouseId, logLimit, page]);

  return { logs, isLoading, error };
}
