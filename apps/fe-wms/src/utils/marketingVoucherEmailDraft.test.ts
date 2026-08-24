import assert from "node:assert/strict";
import test from "node:test";

import type { MarketingVoucherCode } from "@bduck/shared-types";

import { buildMarketingVoucherEmailRecipients } from "./marketingVoucherEmailDraft";

const codes = ["CODE-A", "CODE-B"].map(
  (id) => ({ id }) as MarketingVoucherCode,
);

test("grouped voucher email produces one normalized recipient", () => {
  assert.deepEqual(
    buildMarketingVoucherEmailRecipients({
      mode: "GROUPED",
      codes,
      groupedEmail: "  USER@Example.com ",
      individualEmails: {},
    }),
    [{ email: "user@example.com", voucher_code_ids: ["CODE-A", "CODE-B"] }],
  );
});

test("individual voucher email requires a valid address for every code", () => {
  assert.equal(
    buildMarketingVoucherEmailRecipients({
      mode: "INDIVIDUAL",
      codes,
      groupedEmail: "",
      individualEmails: { "CODE-A": "one@example.com" },
    }),
    null,
  );
  assert.deepEqual(
    buildMarketingVoucherEmailRecipients({
      mode: "INDIVIDUAL",
      codes,
      groupedEmail: "",
      individualEmails: {
        "CODE-A": "ONE@example.com",
        "CODE-B": "two@example.com",
      },
    }),
    [
      { email: "one@example.com", voucher_code_ids: ["CODE-A"] },
      { email: "two@example.com", voucher_code_ids: ["CODE-B"] },
    ],
  );
});
