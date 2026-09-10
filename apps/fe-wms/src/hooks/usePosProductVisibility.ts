"use client";

import type {
  PosProductCatalogSyncResult,
  PosProductVisibilityCatalogItem,
  PosProductVisibilitySettings,
} from "@bduck/shared-types";
import { doc, onSnapshot } from "firebase/firestore";
import { gooeyToast } from "goey-toast";
import { useCallback, useEffect, useRef, useState } from "react";

import { posManagementApi } from "@/api/posManagementApi";
import { db } from "@/lib/firebase";

const mapSnapshot = (
  warehouseId: string,
  value: Record<string, unknown>,
): PosProductVisibilitySettings =>
  ({
    id: warehouseId,
    warehouse_id: warehouseId,
    ...value,
  }) as PosProductVisibilitySettings;

export function usePosProductVisibility(
  warehouseId: string,
  loadErrorMessage: string,
) {
  const [products, setProducts] = useState<PosProductVisibilityCatalogItem[]>(
    [],
  );
  const [settings, setSettings] = useState<PosProductVisibilitySettings | null>(
    null,
  );
  const [lastSyncResult, setLastSyncResult] =
    useState<PosProductCatalogSyncResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const saveInFlight = useRef<Promise<void> | null>(null);
  const syncInFlight = useRef<Promise<PosProductCatalogSyncResult> | null>(
    null,
  );

  const reload = useCallback(async () => {
    const view =
      await posManagementApi.getProductVisibilitySettings(warehouseId);
    setProducts(view.products);
    setSettings(view.settings);
  }, [warehouseId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void posManagementApi
      .getProductVisibilitySettings(warehouseId)
      .then((view) => {
        if (!active) return;
        setProducts(view.products);
        setSettings(view.settings);
      })
      .catch((error) => {
        console.error("[usePosProductVisibility] load failed:", error);
        gooeyToast.error(loadErrorMessage);
      })
      .finally(() => active && setLoading(false));

    const unsubscribe = onSnapshot(
      doc(db, "pos_product_visibility_settings", warehouseId),
      (snapshot) => {
        if (active) {
          setSettings(
            snapshot.exists()
              ? mapSnapshot(warehouseId, snapshot.data())
              : null,
          );
        }
      },
      (error) =>
        console.error("[usePosProductVisibility] snapshot failed:", error),
    );
    return () => {
      active = false;
      unsubscribe();
    };
  }, [loadErrorMessage, warehouseId]);

  const save = useCallback(
    async (disabledGroupKeys: string[], disabledProductIds: string[]) => {
      if (saveInFlight.current) return saveInFlight.current;
      const pending = (async () => {
        setSaving(true);
        try {
          const next = await posManagementApi.saveProductVisibilitySettings(
            warehouseId,
            {
              expected_version: settings?.version ?? 0,
              disabled_group_keys: disabledGroupKeys,
              disabled_product_ids: disabledProductIds,
              action_time: new Date().toISOString(),
            },
          );
          setSettings(next);
        } catch (error: unknown) {
          await reload().catch((reloadError: unknown) => {
            console.error(
              "[usePosProductVisibility] reload after save failed:",
              reloadError,
            );
          });
          throw error;
        } finally {
          setSaving(false);
          saveInFlight.current = null;
        }
      })();
      saveInFlight.current = pending;
      return pending;
    },
    [reload, settings?.version, warehouseId],
  );

  const sync = useCallback(
    async (requestId: string) => {
      if (syncInFlight.current) return syncInFlight.current;
      const pending = (async () => {
        setSyncing(true);
        try {
          const result = await posManagementApi.syncProducts(warehouseId, {
            request_id: requestId,
            action_time: new Date().toISOString(),
          });
          await reload();
          setLastSyncResult(result);
          return result;
        } finally {
          setSyncing(false);
          syncInFlight.current = null;
        }
      })();
      syncInFlight.current = pending;
      return pending;
    },
    [reload, warehouseId],
  );

  return {
    products,
    settings,
    lastSyncResult,
    loading,
    saving,
    syncing,
    save,
    sync,
  };
}
