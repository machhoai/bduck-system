"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type MarketingVoucherEmailMode = "GROUPED" | "INDIVIDUAL";

interface MarketingVoucherEmailDraft {
  campaign_id: string;
  code_ids: string[];
  mode: MarketingVoucherEmailMode;
  grouped_email: string;
  individual_emails: Record<string, string>;
  subject: string;
  introduction: string;
}

const emptyDraft = (): MarketingVoucherEmailDraft => ({
  campaign_id: "",
  code_ids: [],
  mode: "GROUPED",
  grouped_email: "",
  individual_emails: {},
  subject: "",
  introduction: "",
});

interface MarketingVoucherEmailDraftState {
  draft: MarketingVoucherEmailDraft;
  begin: (
    campaignId: string,
    codeIds: string[],
    defaultSubject: string,
  ) => void;
  update: (patch: Partial<MarketingVoucherEmailDraft>) => void;
  setIndividualEmail: (codeId: string, email: string) => void;
  reset: () => void;
}

export const useMarketingVoucherEmailDraftStore =
  create<MarketingVoucherEmailDraftState>()(
    persist(
      (set) => ({
        draft: emptyDraft(),
        begin: (campaignId, codeIds, defaultSubject) =>
          set((state) => {
            const sameCampaign = state.draft.campaign_id === campaignId;
            const selected = new Set(codeIds);
            return {
              draft: {
                ...(sameCampaign ? state.draft : emptyDraft()),
                campaign_id: campaignId,
                code_ids: codeIds,
                subject:
                  sameCampaign && state.draft.subject
                    ? state.draft.subject
                    : defaultSubject,
                individual_emails: Object.fromEntries(
                  Object.entries(state.draft.individual_emails).filter(
                    ([codeId]) => selected.has(codeId),
                  ),
                ),
              },
            };
          }),
        update: (patch) =>
          set((state) => ({ draft: { ...state.draft, ...patch } })),
        setIndividualEmail: (codeId, email) =>
          set((state) => ({
            draft: {
              ...state.draft,
              individual_emails: {
                ...state.draft.individual_emails,
                [codeId]: email,
              },
            },
          })),
        reset: () => set({ draft: emptyDraft() }),
      }),
      {
        name: "jpulse-marketing-voucher-email-draft",
        storage: createJSONStorage(() => sessionStorage),
      },
    ),
  );
