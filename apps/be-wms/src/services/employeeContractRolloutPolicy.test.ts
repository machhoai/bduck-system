import assert from "node:assert/strict";
import test from "node:test";

import { resolveEmployeeContractsFeatureEnabled } from "@bduck/shared-types";

test("contract feature defaults off in production and on elsewhere", () => {
  assert.equal(
    resolveEmployeeContractsFeatureEnabled(undefined, "production"),
    false,
  );
  assert.equal(
    resolveEmployeeContractsFeatureEnabled(undefined, "development"),
    true,
  );
});

test("contract feature accepts explicit values and rejects invalid config", () => {
  assert.equal(
    resolveEmployeeContractsFeatureEnabled("enabled", "production"),
    true,
  );
  assert.equal(
    resolveEmployeeContractsFeatureEnabled("false", "development"),
    false,
  );
  assert.throws(
    () =>
      resolveEmployeeContractsFeatureEnabled("sometimes", "production"),
    /EMPLOYEE_CONTRACTS_FEATURE_ENABLED_INVALID/,
  );
});
