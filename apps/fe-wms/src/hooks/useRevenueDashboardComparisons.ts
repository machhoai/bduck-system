"use client";

import type {
  RevenueDashboardData,
  RevenueDashboardFilter,
  RevenueDataSource,
} from "@bduck/shared-types";
import { useEffect, useMemo, useState } from "react";

import {
  fetchRevenueDashboard,
  getRevenueDashboardErrorMessage,
} from "./revenueDashboardApi";
import {
  buildRevenueDashboardQuery,
  DEFAULT_REVENUE_WAREHOUSE_ID,
} from "./revenueDashboardFilters";

export function useRevenueDashboardComparisons(
  filters: RevenueDashboardFilter[],
  warehouseId = DEFAULT_REVENUE_WAREHOUSE_ID,
  source: RevenueDataSource = "OPEN_API",
) {
  const [data, setData] = useState<RevenueDashboardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queries = useMemo(
    () => filters.map((filter) => buildRevenueDashboardQuery(filter, warehouseId, source)),
    [filters, source, warehouseId],
  );
  const queriesKey = JSON.stringify(queries);

  useEffect(() => {
    if (queries.length === 0) {
      setData([]);
      setLoading(false);
      setSyncing(false);
      setError(null);
      return;
    }
    let disposed = false;
    const controller = new AbortController();
    setLoading(true);
    setSyncing(true);
    setError(null);

    Promise.all(
      queries.map((query) => fetchRevenueDashboard(query, controller.signal)),
    )
      .then((dashboards) => {
        if (!disposed) setData(dashboards);
      })
      .catch((cause) => {
        if (!controller.signal.aborted && !disposed) {
          setError(getRevenueDashboardErrorMessage(cause));
        }
      })
      .finally(() => {
        if (!disposed) {
          setLoading(false);
          setSyncing(false);
        }
      });

    return () => {
      disposed = true;
      controller.abort();
    };
    // queriesKey is a stable primitive representation of the comparison request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queriesKey]);

  return { data, loading, syncing, error };
}
