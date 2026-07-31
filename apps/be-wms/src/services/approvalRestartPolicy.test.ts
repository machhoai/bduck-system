import assert from "node:assert/strict";
import test from "node:test";

import type { ApprovalRecord } from "@bduck/shared-types";

import {
  assertApprovalRestartable,
  getCurrentApprovalAttempt,
} from "./approvalRestartPolicy.js";

const record = (
  id: string,
  attempt: number,
  status: ApprovalRecord["status"],
): ApprovalRecord => ({
  id,
  entity_type: "IMPORT_VOUCHER",
  entity_id: "voucher-a",
  warehouse_id: "warehouse-a",
  level: 0,
  approval_attempt: attempt,
  role_id: "accounting-manager",
  status,
  approver_id: status === "PENDING" ? null : "approver-a",
  approved_at: status === "PENDING" ? null : new Date(),
  rejected_reason: null,
  comments: null,
  creator_id: "creator-a",
  action_time: new Date(),
  sync_time: new Date(),
  created_at: new Date(),
});

test("only the latest approval attempt determines restart eligibility", () => {
  const current = getCurrentApprovalAttempt([
    record("old-approved", 1, "APPROVED"),
    record("current-pending", 2, "PENDING"),
  ]);

  assert.equal(current.attempt, 2);
  assert.doesNotThrow(() =>
    assertApprovalRestartable(
      "IMPORT_VOUCHER",
      "PENDING_APPROVAL",
      current,
    ),
  );
});

test("restart is rejected after a level in the current attempt was approved", () => {
  const current = getCurrentApprovalAttempt([
    record("current-approved", 2, "APPROVED"),
    record("current-pending", 2, "PENDING"),
  ]);

  assert.throws(
    () =>
      assertApprovalRestartable(
        "IMPORT_VOUCHER",
        "PENDING_APPROVAL",
        current,
      ),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 409,
  );
});

test("rejected vouchers may start a new unapproved attempt", () => {
  const current = getCurrentApprovalAttempt([
    record("current-rejected", 2, "REJECTED"),
  ]);

  assert.doesNotThrow(() =>
    assertApprovalRestartable("IMPORT_VOUCHER", "REJECTED", current),
  );
});
