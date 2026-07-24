import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApprovalRecord } from "@bduck/shared-types";
import { resolveExternalQueueNextApproval } from "./externalQueueApprovalProgress.js";

const approval = (overrides: Partial<ApprovalRecord>): ApprovalRecord => ({
  id: crypto.randomUUID(),
  entity_type: "EXPORT_VOUCHER",
  config_entity_type: "EXTERNAL_QUEUE_EXPORT",
  entity_id: "voucher-1",
  warehouse_id: "warehouse-1",
  level: 1,
  approval_attempt: 1,
  role_id: "role-level-2",
  status: "PENDING",
  approver_id: null,
  approved_at: null,
  rejected_reason: null,
  comments: null,
  creator_id: "creator-1",
  action_time: new Date(),
  sync_time: new Date(),
  created_at: new Date(),
  ...overrides,
});

describe("resolveExternalQueueNextApproval", () => {
  it("returns the first pending display level and role name", () => {
    const result = resolveExternalQueueNextApproval(
      [
        approval({ level: 1, status: "PENDING" }),
        approval({
          level: 2,
          role_id: "role-level-3",
          status: "PENDING",
        }),
      ],
      new Map([["role-level-2", "Warehouse manager"]]),
    );

    assert.deepEqual(result, {
      level: 2,
      role_id: "role-level-2",
      role_name: "Warehouse manager",
      approved_count: 0,
      required_count: 1,
    });
  });

  it("reports multi-approver progress and advances after completion", () => {
    const records = [
      approval({ id: "level-2-approved", status: "APPROVED" }),
      approval({ id: "level-2-pending", status: "PENDING" }),
      approval({
        id: "level-3-pending",
        level: 2,
        role_id: "role-level-3",
        status: "PENDING",
      }),
    ];

    assert.deepEqual(resolveExternalQueueNextApproval(records, new Map()), {
      level: 2,
      role_id: "role-level-2",
      role_name: null,
      approved_count: 1,
      required_count: 2,
    });

    assert.equal(
      resolveExternalQueueNextApproval(
        records.map((record) =>
          record.level === 1
            ? { ...record, status: "APPROVED" as const }
            : record,
        ),
        new Map(),
      )?.level,
      3,
    );
  });

  it("ignores pending records from an older approval attempt", () => {
    const result = resolveExternalQueueNextApproval(
      [
        approval({ approval_attempt: 1, level: 1, status: "PENDING" }),
        approval({
          approval_attempt: 2,
          level: 2,
          role_id: "latest-role",
          status: "PENDING",
        }),
      ],
      new Map(),
    );

    assert.equal(result?.level, 3);
    assert.equal(result?.role_id, "latest-role");
  });
});
