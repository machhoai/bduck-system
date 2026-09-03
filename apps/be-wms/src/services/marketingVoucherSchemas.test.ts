import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  createMarketingVoucherCampaignSchema,
  createMarketingVoucherEmailJobSchema,
  createMarketingVoucherExportJobSchema,
  revokeMarketingVoucherCodesSchema,
  resolveMarketingVouchersFeatureEnabled,
} from "@bduck/shared-types";

const validCampaign = {
  name: "Summer 2026",
  description: "Campaign for printed tickets",
  reward_type: "DISCOUNT_PERCENT",
  reward_value: 10,
  valid_from: "2026-08-20",
  valid_to: "2026-12-31",
  prefix: "SUMMER-",
  code_length: 10,
  suffix: "-26",
  purpose: "PRINT",
  accent_color: "#F59E0B",
  requested_code_count: 1_000_000,
  idempotency_key: "campaign:summer-2026",
  action_time: "2026-08-20T08:00:00.000Z",
};

describe("marketing voucher schemas", () => {
  it("accepts the maximum supported generation request", () => {
    const parsed = createMarketingVoucherCampaignSchema.parse(validCampaign);
    assert.equal(parsed.requested_code_count, 1_000_000);
    assert.ok(parsed.action_time instanceof Date);
  });

  it("rejects unsafe occupancy for short random codes", () => {
    const parsed = createMarketingVoucherCampaignSchema.safeParse({
      ...validCampaign,
      code_length: 4,
      requested_code_count: 1_000_000,
    });
    assert.equal(parsed.success, false);
  });

  it("rejects invalid dates, percent values and NoSQL operators", () => {
    assert.equal(
      createMarketingVoucherCampaignSchema.safeParse({
        ...validCampaign,
        valid_to: "2026-02-30",
      }).success,
      false,
    );
    assert.equal(
      createMarketingVoucherCampaignSchema.safeParse({
        ...validCampaign,
        valid_to: "2026-01-01",
      }).success,
      false,
    );
    assert.equal(
      createMarketingVoucherCampaignSchema.safeParse({
        ...validCampaign,
        reward_value: 101,
      }).success,
      false,
    );
    assert.equal(
      createMarketingVoucherCampaignSchema.safeParse({
        ...validCampaign,
        description: "$where should never reach a Firestore query",
      }).success,
      false,
    );
  });

  it("keeps rollout disabled by default and rejects ambiguous flag values", () => {
    assert.equal(resolveMarketingVouchersFeatureEnabled(undefined), false);
    assert.equal(resolveMarketingVouchersFeatureEnabled("enabled"), true);
    assert.throws(() => resolveMarketingVouchersFeatureEnabled("maybe"));
  });

  it("bounds bulk revoke and email fan-out payloads", () => {
    const revoke = revokeMarketingVoucherCodesSchema.safeParse({
      code_ids: Array.from({ length: 5_001 }, (_, index) => `CODE-${index}`),
      reason: "Cancelled print run",
      idempotency_key: "revoke:summer-2026",
      action_time: "2026-08-20T08:00:00.000Z",
    });
    assert.equal(revoke.success, false);

    const email = createMarketingVoucherEmailJobSchema.safeParse({
      campaign_id: "campaign-a",
      recipients: [{ email: "invalid-email", voucher_code_ids: ["CODE-A"] }],
      subject: "Your voucher",
      introduction: "Welcome",
      idempotency_key: "email:summer-2026",
      action_time: "2026-08-20T08:00:00.000Z",
    });
    assert.equal(email.success, false);

    const duplicateCodes = createMarketingVoucherEmailJobSchema.safeParse({
      campaign_id: "campaign-a",
      recipients: [
        { email: "one@example.com", voucher_code_ids: ["CODE-A"] },
        { email: "two@example.com", voucher_code_ids: ["code-a"] },
      ],
      subject: "Your voucher",
      introduction: "Welcome",
      idempotency_key: "email:duplicate",
      action_time: "2026-08-20T08:00:00.000Z",
    });
    assert.equal(duplicateCodes.success, false);

    const tooManyRecipients = createMarketingVoucherEmailJobSchema.safeParse({
      campaign_id: "campaign-a",
      recipients: Array.from({ length: 401 }, (_, index) => ({
        email: `user-${index}@example.com`,
        voucher_code_ids: [`CODE-${index}`],
      })),
      subject: "Your voucher",
      introduction: "Welcome",
      idempotency_key: "email:too-many",
      action_time: "2026-08-20T08:00:00.000Z",
    });
    assert.equal(tooManyRecipients.success, false);
  });

  it("requires revision and accepts only supported export locales", () => {
    const valid = createMarketingVoucherExportJobSchema.safeParse({
      campaign_id: "campaign-a",
      locale: "vi",
      expected_revision: 3,
      idempotency_key: "export:campaign-a",
      action_time: "2026-09-03T08:00:00.000Z",
    });
    assert.equal(valid.success, true);
    assert.equal(
      createMarketingVoucherExportJobSchema.safeParse({
        campaign_id: "campaign-a",
        locale: "en",
        expected_revision: 3,
        idempotency_key: "export:campaign-a-2",
        action_time: "2026-09-03T08:00:00.000Z",
      }).success,
      false,
    );
  });
});
