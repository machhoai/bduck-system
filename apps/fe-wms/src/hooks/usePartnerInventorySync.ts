"use client";

import type {
  PartnerInventoryComparisonSnapshot,
  PartnerInventorySyncJobDto,
} from "@bduck/shared-types";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  createPartnerInventoryComparison,
  createPartnerInventorySyncJob,
  reconcilePartnerInventorySyncJob,
} from "@/api/partnerInventoryApi";

export const usePartnerInventorySync = (
  warehouseId: string,
  isOpen: boolean,
) => {
  const selectionLimit = 200;
  const [snapshot, setSnapshot] =
    useState<PartnerInventoryComparisonSnapshot | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [job, setJob] = useState<PartnerInventorySyncJobDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSelectedIds(new Set());
    try {
      const data = await createPartnerInventoryComparison(warehouseId);
      setSnapshot(data);
      return data;
    } catch (loadError) {
      console.error("[usePartnerInventorySync] load failed:", loadError);
      setSnapshot(null);
      setError(loadError instanceof Error ? loadError.message : "JoyWorld error");
      throw loadError;
    } finally {
      setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    if (!isOpen) return;
    void load().catch(() => undefined);
  }, [isOpen, load]);

  const eligibleIds = useMemo(
    () =>
      (snapshot?.rows || [])
        .filter((row) => row.eligible && row.product_id)
        .map((row) => row.product_id!),
    [snapshot],
  );

  const toggle = (productId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(productId)) next.delete(productId);
      else if (next.size < selectionLimit) next.add(productId);
      return next;
    });
  };

  const toggleAll = () => {
    if (eligibleIds.length > selectionLimit) return;
    setSelectedIds((current) =>
      eligibleIds.every((id) => current.has(id))
        ? new Set()
        : new Set(eligibleIds),
    );
  };

  const synchronize = async () => {
    if (!snapshot || selectedIds.size === 0 || syncing) return null;
    setSyncing(true);
    setError(null);
    try {
      const result = await createPartnerInventorySyncJob(warehouseId, {
        snapshotId: snapshot.id,
        productIds: Array.from(selectedIds),
        requestId: crypto.randomUUID(),
      });
      setJob(result);
      await load().catch(() => undefined);
      return result;
    } catch (syncError) {
      console.error("[usePartnerInventorySync] sync failed:", syncError);
      setError(syncError instanceof Error ? syncError.message : "JoyWorld error");
      throw syncError;
    } finally {
      setSyncing(false);
    }
  };

  const reconcile = async () => {
    if (!job || job.status !== "UNKNOWN" || reconciling) return null;
    setReconciling(true);
    setError(null);
    try {
      const result = await reconcilePartnerInventorySyncJob(
        warehouseId,
        job.request_id,
      );
      setJob(result);
      if (result.status !== "UNKNOWN") await load().catch(() => undefined);
      return result;
    } catch (reconcileError) {
      setError(
        reconcileError instanceof Error
          ? reconcileError.message
          : "JoyWorld error",
      );
      throw reconcileError;
    } finally {
      setReconciling(false);
    }
  };

  return {
    snapshot,
    selectedIds,
    eligibleIds,
    selectionLimit,
    job,
    loading,
    syncing,
    reconciling,
    error,
    load,
    toggle,
    toggleAll,
    synchronize,
    reconcile,
  };
};
