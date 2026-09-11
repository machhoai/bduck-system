import assert from "node:assert/strict";
import test from "node:test";

import { posVoucherCampaignSettingSchema } from "./posVoucherSettingsSchemas.js";

test("accepts an audited per-store voucher mapping", () => {
  const result = posVoucherCampaignSettingSchema.parse({
    enabled: true,
    product_id: "TICKET-01",
    quantity: 2,
    expected_version: 0,
    action_time: "2026-09-10T09:00:00+07:00",
  });
  assert.equal(result.quantity, 2);
});

test("rejects unsafe identifiers and invalid quantities", () => {
  assert.throws(() => posVoucherCampaignSettingSchema.parse({
    enabled: true,
    product_id: "$where",
    quantity: 0,
    expected_version: 0,
    action_time: "2026-09-10T09:00:00+07:00",
  }));
});
