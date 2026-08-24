import {
  marketingVoucherEmailRecipientSchema,
  type MarketingVoucherCode,
} from "@bduck/shared-types";

import type { MarketingVoucherEmailMode } from "@/stores/useMarketingVoucherEmailDraftStore";

export const buildMarketingVoucherEmailRecipients = (input: {
  mode: MarketingVoucherEmailMode;
  codes: MarketingVoucherCode[];
  groupedEmail: string;
  individualEmails: Record<string, string>;
}) => {
  const recipients =
    input.mode === "GROUPED"
      ? [
          {
            email: input.groupedEmail.trim().toLowerCase(),
            voucher_code_ids: input.codes.map((code) => code.id),
          },
        ]
      : input.codes.map((code) => ({
          email: (input.individualEmails[code.id] ?? "").trim().toLowerCase(),
          voucher_code_ids: [code.id],
        }));
  return recipients.every(
    (recipient) =>
      marketingVoucherEmailRecipientSchema.safeParse(recipient).success,
  )
    ? recipients
    : null;
};
