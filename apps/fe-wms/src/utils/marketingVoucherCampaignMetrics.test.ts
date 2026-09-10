import assert from "node:assert/strict";
import test from "node:test";

import { summarizeMarketingVoucherCampaign } from "./marketingVoucherCampaignMetrics.js";

test("summarizes issued, usage and available campaign rates", () => {
  const summary = summarizeMarketingVoucherCampaign({
    code_counts: {
      total: 1_000,
      available: 700,
      distributed: 200,
      used: 50,
      revoked: 50,
    },
    valid_from: "2026-06-15",
    valid_to: "2026-07-31",
  });

  assert.equal(summary.issued, 250);
  assert.equal(summary.issuedRate, 25);
  assert.equal(summary.usageRate, 20);
  assert.equal(summary.availabilityRate, 70);
  assert.equal(summary.durationDays, 47);
  assert.equal(summary.inventoryHealth, "HEALTHY");
});

test("reports low and empty inventory without dividing by zero", () => {
  const low = summarizeMarketingVoucherCampaign({
    code_counts: {
      total: 100,
      available: 10,
      distributed: 80,
      used: 5,
      revoked: 5,
    },
    valid_from: "2026-09-01",
    valid_to: "2026-09-01",
  });
  const empty = summarizeMarketingVoucherCampaign({
    code_counts: {
      total: 0,
      available: 0,
      distributed: 0,
      used: 0,
      revoked: 0,
    },
    valid_from: "2026-09-01",
    valid_to: "2026-09-01",
  });

  assert.equal(low.inventoryHealth, "LOW");
  assert.equal(low.durationDays, 1);
  assert.equal(empty.inventoryHealth, "EMPTY");
  assert.equal(empty.issuedRate, 0);
  assert.equal(empty.usageRate, 0);
  assert.equal(empty.availabilityRate, 0);
});
