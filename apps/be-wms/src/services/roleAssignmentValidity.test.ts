import assert from "node:assert/strict";
import test from "node:test";
import type { UserWarehouseRole } from "@bduck/shared-types";
import { activeRoleAssignments } from "./scopedRoleAccess.js";
import {
  formatRoleAssignmentDate,
  parseRoleAssignmentDate,
} from "./roleAssignmentValidity.js";

const assignment = (
  overrides: Partial<UserWarehouseRole> = {},
): UserWarehouseRole => ({
  id: "assignment-a",
  user_id: "user-a",
  warehouse_id: "warehouse-a",
  role_id: "role-a",
  assigned_by: "admin-a",
  valid_from: "2026-07-15",
  valid_until: null,
  is_active: true,
  is_deleted: false,
  created_at: new Date("2026-07-01T00:00:00.000Z"),
  ...overrides,
});

test("parses Ho Chi Minh DATE boundaries without UTC truncation", () => {
  assert.equal(
    parseRoleAssignmentDate("2026-07-15", "START")?.toISOString(),
    "2026-07-14T17:00:00.000Z",
  );
  assert.equal(
    parseRoleAssignmentDate("2026-07-15", "END")?.toISOString(),
    "2026-07-15T16:59:59.999Z",
  );
});

test("formats assignment DATE using the Ho Chi Minh calendar day", () => {
  assert.equal(
    formatRoleAssignmentDate(new Date("2026-07-15T16:59:59.999Z")),
    "2026-07-15",
  );
  assert.equal(
    formatRoleAssignmentDate(new Date("2026-07-15T17:00:00.000Z")),
    "2026-07-16",
  );
});

test("keeps active assignments and rejects inactive or soft-deleted ones", () => {
  const now = new Date("2026-07-15T03:00:00.000Z");
  const result = activeRoleAssignments(
    [
      assignment(),
      assignment({ id: "inactive", is_active: false }),
      assignment({ id: "deleted", is_deleted: true }),
      assignment({ id: "empty-scope", warehouse_id: "" }),
    ],
    now,
  );

  assert.deepEqual(
    result.map(({ id }) => id),
    ["assignment-a"],
  );
});

test("recognizes only exact null as global scope", () => {
  const now = new Date("2026-07-15T03:00:00.000Z");
  const result = activeRoleAssignments(
    [
      assignment({ id: "global", warehouse_id: null }),
      assignment({ id: "empty", warehouse_id: "" }),
      assignment({ id: "whitespace", warehouse_id: "   " }),
    ],
    now,
  );

  assert.deepEqual(
    result.map(({ id }) => id),
    ["global"],
  );
});

test("rejects future and expired assignments", () => {
  const now = new Date("2026-07-15T03:00:00.000Z");
  const result = activeRoleAssignments(
    [
      assignment({ id: "future", valid_from: "2026-07-16" }),
      assignment({ id: "expired", valid_until: "2026-07-14" }),
    ],
    now,
  );

  assert.deepEqual(result, []);
});

test("treats valid_until as inclusive through the final GMT+7 millisecond", () => {
  const lastMillisecond = new Date("2026-07-15T16:59:59.999Z");
  const firstExpiredMillisecond = new Date("2026-07-15T17:00:00.000Z");
  const expiring = assignment({ valid_until: "2026-07-15" });

  assert.equal(activeRoleAssignments([expiring], lastMillisecond).length, 1);
  assert.equal(
    activeRoleAssignments([expiring], firstExpiredMillisecond).length,
    0,
  );
});

test("activates valid_from exactly at the GMT+7 start boundary", () => {
  const future = assignment({ valid_from: "2026-07-16" });

  assert.equal(
    activeRoleAssignments([future], new Date("2026-07-15T16:59:59.999Z"))
      .length,
    0,
  );
  assert.equal(
    activeRoleAssignments([future], new Date("2026-07-15T17:00:00.000Z"))
      .length,
    1,
  );
});

test("fails closed for malformed calendar dates", () => {
  const now = new Date("2026-07-15T03:00:00.000Z");

  assert.equal(parseRoleAssignmentDate("2026-02-30", "START"), null);
  assert.equal(
    activeRoleAssignments([assignment({ valid_from: "2026-02-30" })], now)
      .length,
    0,
  );
  assert.equal(
    activeRoleAssignments([assignment({ valid_from: "" })], now).length,
    0,
  );
  assert.equal(
    activeRoleAssignments([assignment()], new Date("invalid")).length,
    0,
  );
});

test("preserves exact instants for legacy ISO assignment timestamps", () => {
  const legacy = assignment({
    valid_from: "2026-07-15T03:00:00.000Z",
    valid_until: "2026-07-15T04:00:00.000Z",
  });

  assert.equal(
    activeRoleAssignments([legacy], new Date("2026-07-15T02:59:59.999Z"))
      .length,
    0,
  );
  assert.equal(
    activeRoleAssignments([legacy], new Date("2026-07-15T03:00:00.000Z"))
      .length,
    1,
  );
  assert.equal(
    activeRoleAssignments([legacy], new Date("2026-07-15T04:00:00.001Z"))
      .length,
    0,
  );
});
