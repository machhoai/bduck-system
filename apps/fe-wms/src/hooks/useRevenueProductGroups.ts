"use client";

import type { RevenueProductGroups } from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { useEffect, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import { authenticatedFetch } from "@/utils/authenticatedFetch";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";
const EMPTY_GROUPS: RevenueProductGroups = {};

export function useRevenueProductGroups(warehouseId: string, enabled: boolean) {
  const { t, lang } = useTranslation();
  const accessEpoch = useUserStore((state) => state.accessEpoch);
  const scopeKey = `${accessEpoch}:${warehouseId}`;
  const [state, setState] = useState({
    scopeKey: "",
    groups: EMPTY_GROUPS,
    loading: true,
    error: null as string | null,
  });
  const errorMessage = t.revenue.export.productGroupsError;
  useEffect(() => {
    if (!enabled || !warehouseId) return;
    const controller = new AbortController();
    let inFlight = false;
    let notified = false;
    const load = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        const response = await authenticatedFetch(
          `${API_BASE_URL}/api/revenue/product-groups?warehouseId=${encodeURIComponent(warehouseId)}`,
          { signal: controller.signal },
        );
        const payload = await response.json();
        if (!response.ok || !payload.success)
          throw new Error(payload.messages?.[lang] ?? errorMessage);
        notified = false;
        if (!controller.signal.aborted)
          setState((current) => ({
            scopeKey,
            groups:
              current.scopeKey === scopeKey &&
              JSON.stringify(current.groups) === JSON.stringify(payload.data)
                ? current.groups
                : (payload.data as RevenueProductGroups),
            loading: false,
            error: null,
          }));
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("[useRevenueProductGroups] error:", error);
        if (!notified) gooeyToast.error(errorMessage);
        notified = true;
        setState((current) => ({
          ...current,
          scopeKey,
          groups: current.scopeKey === scopeKey ? current.groups : EMPTY_GROUPS,
          loading: false,
          error: errorMessage,
        }));
      } finally {
        inFlight = false;
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [enabled, errorMessage, lang, scopeKey, warehouseId]);
  const current = enabled && state.scopeKey === scopeKey;
  return {
    groups: current ? state.groups : EMPTY_GROUPS,
    loading: enabled && (!current || state.loading),
    error: current ? state.error : null,
  };
}
