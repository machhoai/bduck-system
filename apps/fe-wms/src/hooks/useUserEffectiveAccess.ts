"use client";

import { useEffect, useState } from "react";
import type { UserEffectiveAccessSnapshot } from "@bduck/shared-types";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { createDetailedApiError } from "@/utils/apiError";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export function useUserEffectiveAccess(userId?: string | null) {
  const [data, setData] = useState<UserEffectiveAccessSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(Boolean(userId));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      if (!userId) {
        setData(null);
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/users/${userId}/effective-access`,
          { credentials: "include", signal: controller.signal },
        );
        const body = await response.json().catch(() => null);
        if (!response.ok || !body?.success) {
          throw createDetailedApiError(
            response,
            body,
            "Khong the tai quyen hieu luc.",
          );
        }
        setData(body.data as UserEffectiveAccessSnapshot);
        setError(null);
      } catch (loadError) {
        if (controller.signal.aborted) return;
        setData(null);
        setError(
          loadError instanceof Error ? loadError.message : "Load failed",
        );
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    };
    void load();
    const unsubscribe = subscribeDataMutation(
      ["users", "user_warehouse_roles", "user_access", "office_scope_configs"],
      () => void load(),
    );
    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [userId]);

  return { data, isLoading, error };
}
