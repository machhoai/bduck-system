import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ApprovalRecord } from "@bduck/shared-types";
import { resolveExternalQueueNextApproval } from "./externalQueueApprovalProgress.js";
import type { ScopedUser } from "./scopedRoleAccess.js";

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

const scopedUser = (overrides: Partial<ScopedUser> = {}): ScopedUser => ({
  id: "approver-1",
  roleAssignments: [
    {
      id: "assignment-1",
      user_id: "approver-1",
      warehouse_id: "warehouse-1",
      role_id: "role-level-2",
      is_active: true,
      is_deleted: false,
      valid_from: "2026-01-01",
      valid_until: null,
    },
  ],
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

  it("marks the current user's matching scoped role as actionable", () => {
    const result = resolveExternalQueueNextApproval(
      [
        approval({
          id: "pending-for-user",
          approval_warehouse_id: "warehouse-1",
          approval_scope: "ENTITY_WAREHOUSE",
        }),
      ],
      new Map(),
      scopedUser(),
    );

    assert.equal(result?.actionable_record_id, "pending-for-user");
    assert.equal(result?.can_act, true);
  });

  it("does not mark self-created or already-approved levels as actionable", () => {
    const user = scopedUser();

    const selfCreated = resolveExternalQueueNextApproval(
      [
        approval({
          id: "self-created",
          approval_warehouse_id: "warehouse-1",
          creator_id: "approver-1",
        }),
      ],
      new Map(),
      user,
    );
    assert.equal(selfCreated?.actionable_record_id, null);
    assert.equal(selfCreated?.can_act, false);

    const alreadyApproved = resolveExternalQueueNextApproval(
      [
        approval({
          id: "already-approved",
          approval_warehouse_id: "warehouse-1",
          status: "APPROVED",
          approver_id: "approver-1",
        }),
        approval({
          id: "remaining-pending",
          approval_warehouse_id: "warehouse-1",
        }),
      ],
      new Map(),
      user,
    );
    assert.equal(alreadyApproved?.actionable_record_id, null);
    assert.equal(alreadyApproved?.can_act, false);
  });

  it("supports global approval role assignments", () => {
    const result = resolveExternalQueueNextApproval(
      [
        approval({
          id: "global-pending",
          approval_warehouse_id: null,
          approval_scope: "GLOBAL",
        }),
      ],
      new Map(),
      scopedUser({
        roleAssignments: [
          {
            id: "global-assignment",
            user_id: "approver-1",
            warehouse_id: null,
            role_id: "role-level-2",
            is_active: true,
            is_deleted: false,
            valid_from: "2026-01-01",
            valid_until: null,
          },
        ],
      }),
    );

    assert.equal(result?.actionable_record_id, "global-pending");
    assert.equal(result?.can_act, true);
  });
});
