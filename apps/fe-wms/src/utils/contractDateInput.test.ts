import assert from "node:assert/strict";
import test from "node:test";

import { normalizeContractDateInput } from "./contractDateInput.js";

test("normalizes typed and pasted contract dates to DD-MM-YYYY", () => {
  assert.equal(normalizeContractDateInput("2"), "2");
  assert.equal(normalizeContractDateInput("2907"), "29-07");
  assert.equal(normalizeContractDateInput("29/07/2026"), "29-07-2026");
  assert.equal(normalizeContractDateInput("290720261"), "29-07-2026");
});
