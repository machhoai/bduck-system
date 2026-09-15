"use client";

import type {
  PartnerGiftTypeOption,
  PartnerInventoryCapability,
  PartnerWarehouseOption,
} from "@bduck/shared-types";
import { useEffect, useState } from "react";

import { fetchPartnerInventoryMetadata } from "@/api/partnerInventoryApi";

interface MetadataState {
  capability: PartnerInventoryCapability | null;
  warehouses: PartnerWarehouseOption[];
  giftTypes: PartnerGiftTypeOption[];
  loading: boolean;
  error: string | null;
}

export const usePartnerInventoryMetadata = (enabled: boolean) => {
  const [state, setState] = useState<MetadataState>({
    capability: null,
    warehouses: [],
    giftTypes: [],
    loading: enabled,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      setState((current) => ({ ...current, loading: false }));
      return;
    }
    let disposed = false;
    setState((current) => ({ ...current, loading: true, error: null }));
    fetchPartnerInventoryMetadata()
      .then((data) => {
        if (disposed) return;
        setState({
          capability: data.capability,
          warehouses: data.warehouses,
          giftTypes: data.gift_types,
          loading: false,
          error: null,
        });
      })
      .catch((error) => {
        if (disposed) return;
        console.error("[usePartnerInventoryMetadata] load failed:", error);
        setState({
          capability: null,
          warehouses: [],
          giftTypes: [],
          loading: false,
          error: error instanceof Error ? error.message : "JoyWorld error",
        });
      });
    return () => {
      disposed = true;
    };
  }, [enabled]);

  return state;
};

