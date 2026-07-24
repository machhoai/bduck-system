import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertValidCompanyLeavePolicy,
  buildManualLeaveAdjustmentDelta,
} from "./leaveAdministrationPolicy.js";

describe("leave administration policy", () => {
  it("accepts company policy values in half-day units", () => {
    assert.doesNotThrow(() =>
      assertValidCompanyLeavePolicy({
        monthly_accrual_units: 1,
        annual_cap_units: 12,
        action_time: new Date(),
      }),
    );
  });

  it("rejects invalid company policy units", () => {
    assert.throws(() =>
      assertValidCompanyLeavePolicy({
        monthly_accrual_units: 0.3,
        annual_cap_units: 12,
        action_time: new Date(),
      }),
    );
  });

  it("builds positive and negative adjustment deltas", () => {
    assert.equal(buildManualLeaveAdjustmentDelta(1.5).available_units, 1.5);
    assert.equal(buildManualLeaveAdjustmentDelta(-0.5).available_units, -0.5);
  });

  it("rejects zero and non-half-day adjustments", () => {
    assert.throws(() => buildManualLeaveAdjustmentDelta(0));
    assert.throws(() => buildManualLeaveAdjustmentDelta(0.25));
  });
});
