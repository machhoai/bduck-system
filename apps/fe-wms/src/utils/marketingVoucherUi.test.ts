import assert from "node:assert/strict";
import test from "node:test";

import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
  MarketingVoucherJob,
} from "@bduck/shared-types";

import {
  getMarketingVoucherEffectiveStatus,
  marketingVoucherJobProgress,
  summarizeMarketingVoucherCampaigns,
} from "./marketingVoucherUi";

const campaign = (overrides: Partial<MarketingVoucherCampaign> = {}) =>
  ({
    id: "campaign-1",
    status: "ACTIVE",
    code_counts: {
      available: 5,
      distributed: 3,
      used: 2,
      revoked: 1,
      total: 11,
    },
    ...overrides,
  }) as MarketingVoucherCampaign;

const code = (overrides: Partial<MarketingVoucherCode> = {}) =>
  ({
    id: "JPULSE-001",
    campaign_id: "campaign-1",
    status: "AVAILABLE",
    valid_to: "2026-12-31",
    ...overrides,
  }) as MarketingVoucherCode;

const job = (overrides: Partial<MarketingVoucherJob> = {}) =>
  ({
    id: "job-1",
    status: "PROCESSING",
    progress: { total: 100, processed: 40, succeeded: 38, failed: 2 },
    ...overrides,
  }) as MarketingVoucherJob;

test("effective code status preserves terminal states before campaign state", () => {
  assert.equal(
    getMarketingVoucherEffectiveStatus(
      code({ status: "USED" }),
      campaign({ status: "PAUSED" }),
      "2027-01-01",
    ),
    "USED",
  );
  assert.equal(
    getMarketingVoucherEffectiveStatus(
      code({ status: "REVOKED" }),
      campaign({ status: "PAUSED" }),
      "2027-01-01",
    ),
    "REVOKED",
  );
});

test("effective code status exposes paused and expired guards", () => {
  assert.equal(
    getMarketingVoucherEffectiveStatus(
      code(),
      campaign({ status: "PAUSED" }),
      "2026-01-01",
    ),
    "PAUSED",
  );
  assert.equal(
    getMarketingVoucherEffectiveStatus(
      code({ valid_to: "2025-12-31" }),
      campaign(),
      "2026-01-01",
    ),
    "EXPIRED",
  );
});

test("dashboard totals use actual campaign counters", () => {
  const result = summarizeMarketingVoucherCampaigns(
    [
      campaign(),
      campaign({
        id: "campaign-2",
        code_counts: {
          available: 2,
          distributed: 1,
          used: 0,
          revoked: 0,
          total: 3,
        },
      }),
    ],
    [job(), job({ id: "job-2", status: "COMPLETED" })],
  );
  assert.deepEqual(result, {
    campaigns: 2,
    activeCampaigns: 2,
    totalCodes: 14,
    available: 7,
    distributed: 4,
    used: 2,
    revoked: 1,
    activeJobs: 1,
  });
});

test("job progress is bounded and completed empty jobs show 100 percent", () => {
  assert.equal(marketingVoucherJobProgress(job()), 40);
  assert.equal(
    marketingVoucherJobProgress(
      job({ progress: { total: 1, processed: 4, succeeded: 1, failed: 0 } }),
    ),
    100,
  );
  assert.equal(
    marketingVoucherJobProgress(
      job({
        status: "COMPLETED",
        progress: { total: 0, processed: 0, succeeded: 0, failed: 0 },
      }),
    ),
    100,
  );
});
