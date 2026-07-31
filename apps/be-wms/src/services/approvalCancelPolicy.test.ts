import assert from "node:assert/strict";
import test from "node:test";

import type { ApprovalRecord } from "@bduck/shared-types";

import {
  assertApprovalCreator,
  assertCreatorCancelFacilityAccess,
} from "./approvalCancelPolicy.js";

const globalApproval: ApprovalRecord = {
  id: "approval-global",
  entity_type: "IMPORT_VOUCHER",
  entity_id: "voucher-a",
  warehouse_id: "warehouse-a",
  approval_warehouse_id: null,
  approval_scope: "GLOBAL",
  level: 0,
  role_id: "role-accounting",
  status: "PENDING",
  approver_id: null,
  approved_at: null,
  rejected_reason: null,
  comments: null,
  creator_id: "creator-a",
  action_time: new Date("2026-07-31T00:00:00.000Z"),
  sync_time: new Date("2026-07-31T00:00:00.000Z"),
  created_at: new Date("2026-07-31T00:00:00.000Z"),
};

test("creator with voucher write access may cancel a GLOBAL approval", () => {
  const checks: Array<{ action: string; facilityId: string }> = [];

  assert.doesNotThrow(() =>
    assertCreatorCancelFacilityAccess(globalApproval, {
      assert(action, facilityId) {
        checks.push({ action, facilityId });
      },
    }),
  );

  assert.deepEqual(checks, [
    { action: "vouchers.write", facilityId: "warehouse-a" },
  ]);
});

test("a non-creator cannot cancel the approval", () => {
  assert.throws(
    () => assertApprovalCreator(globalApproval, "other-user"),
    (error: unknown) => {
      const candidate = error as {
        statusCode?: number;
        messages?: { vi?: string; zh?: string };
      };
      return (
        candidate.statusCode === 403 &&
        Boolean(candidate.messages?.vi) &&
        Boolean(candidate.messages?.zh)
      );
    },
  );
});

test("creator without voucher write access at the entity warehouse is denied", () => {
  assert.throws(
    () =>
      assertCreatorCancelFacilityAccess(globalApproval, {
        assert() {
          throw new Error("AUTHORIZATION_DENIED");
        },
      }),
    /AUTHORIZATION_DENIED/,
  );
});
