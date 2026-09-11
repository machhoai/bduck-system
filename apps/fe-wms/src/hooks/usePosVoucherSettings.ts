"use client";

import type {
  PosVoucherCampaignSetting,
  PosVoucherSettingsView,
} from "@bduck/shared-types";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";

import { posManagementApi } from "@/api/posManagementApi";
import { db } from "@/lib/firebase";

const EMPTY_VIEW: PosVoucherSettingsView = {
  campaigns: [],
  products: [],
  settings: [],
};

export function usePosVoucherSettings(warehouseId: string) {
  const [view, setView] = useState<PosVoucherSettingsView>(EMPTY_VIEW);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingCampaignId, setSavingCampaignId] = useState<string | null>(null);
  const requestId = useRef(0);

  const refresh = useCallback(async (quiet = false) => {
    if (!warehouseId) return;
    const currentRequest = ++requestId.current;
    if (!quiet) setLoading(true);
    try {
      const next = await posManagementApi.getVoucherSettings(warehouseId);
      if (requestId.current === currentRequest) {
        setView(next);
        setError(null);
      }
    } catch (cause) {
      if (requestId.current === currentRequest) {
        setError(cause instanceof Error ? cause.message : "POS_VOUCHER_SETTINGS_LOAD_FAILED");
      }
      console.error("[usePosVoucherSettings] load failed:", cause);
    } finally {
      if (!quiet && requestId.current === currentRequest) setLoading(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    if (!warehouseId) return;
    void refresh();
    let receivedInitialSnapshot = false;
    return onSnapshot(
      query(
        collection(db, "pos_voucher_campaign_settings"),
        where("warehouse_id", "==", warehouseId),
      ),
      () => {
        if (!receivedInitialSnapshot) {
          receivedInitialSnapshot = true;
          return;
        }
        void refresh(true);
      },
      (cause) => {
        console.error("[usePosVoucherSettings] realtime listener failed:", cause);
        setError(cause.message);
      },
    );
  }, [refresh, warehouseId]);

  const save = useCallback(async (
    campaignId: string,
    value: { enabled: boolean; productId: string; quantity: number },
  ): Promise<PosVoucherCampaignSetting> => {
    const current = view.settings.find(
      (setting) => setting.campaign_id === campaignId,
    );
    setSavingCampaignId(campaignId);
    try {
      const saved = await posManagementApi.saveVoucherSetting(
        warehouseId,
        campaignId,
        {
          enabled: value.enabled,
          product_id: value.productId,
          quantity: value.quantity,
          expected_version: current?.version ?? 0,
          action_time: new Date().toISOString(),
        },
      );
      setView((previous) => ({
        ...previous,
        settings: [
          ...previous.settings.filter(
            (setting) => setting.campaign_id !== campaignId,
          ),
          saved,
        ],
      }));
      return saved;
    } finally {
      setSavingCampaignId(null);
    }
  }, [view.settings, warehouseId]);

  return { ...view, loading, error, refresh, save, savingCampaignId };
}
