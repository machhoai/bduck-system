"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface MarketingVoucherCampaignDraft {
  name: string;
  description: string;
  reward_type:
    | "DISCOUNT_PERCENT"
    | "DISCOUNT_FIXED"
    | "FREE_TICKET"
    | "FREE_ITEM";
  reward_value: string;
  valid_from: string;
  valid_to: string;
  prefix: string;
  code_length: string;
  suffix: string;
  purpose: "EVENT" | "PRINT";
  accent_color: string;
  requested_code_count: string;
}

export const emptyMarketingVoucherCampaignDraft =
  (): MarketingVoucherCampaignDraft => ({
    name: "",
    description: "",
    reward_type: "DISCOUNT_PERCENT",
    reward_value: "10",
    valid_from: "",
    valid_to: "",
    prefix: "",
    code_length: "8",
    suffix: "",
    purpose: "EVENT",
    accent_color: "#F5C542",
    requested_code_count: "100",
  });

interface MarketingVoucherDraftState {
  campaign: MarketingVoucherCampaignDraft;
  updateCampaign: (patch: Partial<MarketingVoucherCampaignDraft>) => void;
  resetCampaign: () => void;
}

export const useMarketingVoucherDraftStore =
  create<MarketingVoucherDraftState>()(
    persist(
      (set) => ({
        campaign: emptyMarketingVoucherCampaignDraft(),
        updateCampaign: (patch) =>
          set((state) => ({ campaign: { ...state.campaign, ...patch } })),
        resetCampaign: () =>
          set({ campaign: emptyMarketingVoucherCampaignDraft() }),
      }),
      {
        name: "jpulse-marketing-voucher-draft",
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({ campaign: state.campaign }),
      },
    ),
  );
