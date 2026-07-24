import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LeaveDayPortion } from "@bduck/shared-types";
import {
  getLeaveSelectionIssue,
  getSelectedLeaveUnits,
} from "./leaveSelection";

const fullDay = (date: string) => ({
  date,
  portion: LeaveDayPortion.FULL_DAY,
});

describe("leave request form selection", () => {
  it("accepts 18, 19, 20 and 22 as one gap", () => {
    assert.equal(
      getLeaveSelectionIssue(
        [
          fullDay("2026-05-18"),
          fullDay("2026-05-19"),
          fullDay("2026-05-20"),
          fullDay("2026-05-22"),
        ],
        new Set(),
      ),
      null,
    );
  });

  it("rejects a gap wider than two days and more than one gap", () => {
    assert.equal(
      getLeaveSelectionIssue(
        [
          fullDay("2026-08-18"),
          fullDay("2026-08-19"),
          fullDay("2026-08-20"),
          fullDay("2026-08-24"),
        ],
        new Set(),
      ),
      "gapTooWide",
    );
    assert.equal(
      getLeaveSelectionIssue(
        [
          fullDay("2026-05-18"),
          fullDay("2026-05-20"),
          fullDay("2026-05-22"),
        ],
        new Set(),
      ),
      "tooManyGaps",
    );
  });

  it("does not count the initial empty date row", () => {
    assert.equal(
      getSelectedLeaveUnits([
        { date: "", portion: LeaveDayPortion.FULL_DAY },
      ]),
      0,
    );
    assert.equal(
      getSelectedLeaveUnits([
        { date: "2026-05-18", portion: LeaveDayPortion.MORNING },
      ]),
      0.5,
    );
  });
});
