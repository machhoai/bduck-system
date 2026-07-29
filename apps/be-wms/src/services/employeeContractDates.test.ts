import assert from "node:assert/strict";
import test from "node:test";

import {
  formatContractDisplayDate,
  getNextContractLocalDate,
  isValidContractLocalDate,
  parseContractDisplayDate,
} from "@bduck/shared-types";

test("parses and formats contract dates without timezone conversion", () => {
  assert.equal(parseContractDisplayDate("29-02-2024"), "2024-02-29");
  assert.equal(formatContractDisplayDate("2026-12-31"), "31-12-2026");
  assert.equal(
    formatContractDisplayDate(parseContractDisplayDate("01-03-2026")),
    "01-03-2026",
  );
});

test("rejects invalid or non-strict contract display dates", () => {
  assert.equal(parseContractDisplayDate("29-02-2025"), null);
  assert.equal(parseContractDisplayDate("31-04-2026"), null);
  assert.equal(parseContractDisplayDate("1-04-2026"), null);
  assert.equal(parseContractDisplayDate("2026-04-01"), null);
  assert.equal(parseContractDisplayDate("01/04/2026"), null);
});

test("validates LocalDate values strictly", () => {
  assert.equal(isValidContractLocalDate("2024-02-29"), true);
  assert.equal(isValidContractLocalDate("2025-02-29"), false);
  assert.equal(isValidContractLocalDate("2026-13-01"), false);
  assert.equal(isValidContractLocalDate("26-01-01"), false);
  assert.equal(formatContractDisplayDate("invalid"), "");
});

test("returns the next LocalDate across month, leap year and year boundaries", () => {
  assert.equal(getNextContractLocalDate("2024-02-28"), "2024-02-29");
  assert.equal(getNextContractLocalDate("2024-02-29"), "2024-03-01");
  assert.equal(getNextContractLocalDate("2026-12-31"), "2027-01-01");
  assert.equal(getNextContractLocalDate("invalid"), null);
});
