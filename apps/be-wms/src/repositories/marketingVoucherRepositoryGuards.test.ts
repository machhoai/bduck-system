import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { MarketingVoucherCampaign } from "@bduck/shared-types";

import {
  assertCampaignActivityAllowed,
  assertCampaignAllowsGeneration,
} from "./marketingVoucherRepositoryGuards.js";

const campaign = (status: "ACTIVE" | "PAUSED" | "ENDED") => ({
  status,
  is_deleted: false,
});

describe("marketing voucher pause guard", () => {
  it("blocks every operational activity while paused", () => {
    for (const activity of [
      "GENERATE",
      "REVOKE",
      "EXTEND",
      "EXPORT",
      "EMAIL",
      "REDEEM",
    ] as const) {
      assert.throws(
        () => assertCampaignActivityAllowed(campaign("PAUSED"), activity),
        (error: unknown) =>
          (error as { code?: string }).code ===
          "MARKETING_VOUCHER_CAMPAIGN_PAUSED",
      );
    }
  });

  it("still permits administrative view and edit while paused", () => {
    for (const activity of ["VIEW", "EDIT"] as const) {
      assert.doesNotThrow(() =>
        assertCampaignActivityAllowed(campaign("PAUSED"), activity),
      );
    }
  });

  it("blocks activities after soft deletion or ending", () => {
    assert.throws(() =>
      assertCampaignActivityAllowed(campaign("ENDED"), "VIEW"),
    );
    assert.throws(() =>
      assertCampaignActivityAllowed(
        { status: "ACTIVE", is_deleted: true },
        "REVOKE",
      ),
    );
  });

  it("does not overlap generation with an expiry extension job", () => {
    assert.throws(
      () =>
        assertCampaignAllowsGeneration({
          status: "ACTIVE",
          is_deleted: false,
          active_generation_job_id: null,
          active_extension_job_id: "extension-job",
        } as MarketingVoucherCampaign),
      (error: unknown) =>
        (error as { code?: string }).code ===
        "MARKETING_VOUCHER_GENERATION_NOT_ALLOWED",
    );
  });
});
