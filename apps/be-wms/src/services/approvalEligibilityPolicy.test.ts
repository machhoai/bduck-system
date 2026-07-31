import assert from "node:assert/strict";
import test from "node:test";

import type { ApprovalLevel } from "@bduck/shared-types";

import {
  getDistinctNonCreatorApprovers,
  hasEnoughEligibleApprovers,
} from "./approvalEligibilityPolicy.js";

const level: ApprovalLevel = {
  level: 0,
  role_id: "role-chief-accountant",
  label: { vi: "Kế toán trưởng", zh: "总会计师" },
  required: true,
  enabled: true,
  min_approvers: 2,
  approval_scope: "ENTITY_WAREHOUSE",
};

test("creator and duplicate users do not count toward eligibility", () => {
  assert.deepEqual(
    getDistinctNonCreatorApprovers(
      ["creator-a", "approver-a", "approver-a", "approver-b"],
      "creator-a",
    ),
    ["approver-a", "approver-b"],
  );
});

test("min_approvers requires enough distinct eligible users", () => {
  assert.equal(
    hasEnoughEligibleApprovers({
      level,
      eligibleUserIds: ["approver-a"],
      requiredApprovers: 2,
    }),
    false,
  );
  assert.equal(
    hasEnoughEligibleApprovers({
      level,
      eligibleUserIds: ["approver-a", "approver-b"],
      requiredApprovers: 2,
    }),
    true,
  );
});
