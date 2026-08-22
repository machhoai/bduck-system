import assert from "node:assert/strict";
import test from "node:test";

import {
  bulkIssueReason,
  isChangedSourceIssue,
} from "./bulkIssueIssueReason.js";

test("bulk issue exclusions have a business reason while retaining the technical code separately", () => {
  assert.match(bulkIssueReason("SOURCE_FINANCIALS_STALE", "vi"), /tiền|thuế/);
  assert.match(bulkIssueReason("UNKNOWN_CODE", "vi"), /IT/);
  assert.equal(isChangedSourceIssue("SOURCE_STALE"), true);
  assert.equal(isChangedSourceIssue("ACTIVE_ISSUE_JOB"), false);
});
