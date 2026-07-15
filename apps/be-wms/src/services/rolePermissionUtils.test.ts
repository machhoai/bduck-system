import assert from "node:assert/strict";
import test from "node:test";
import type { Role } from "@bduck/shared-types";
import { getEffectiveRolePermissions } from "./rolePermissionUtils.js";

const role = (name: string, permissions: Record<string, boolean>): Role => ({
  id: `role-${name}`,
  name,
  description: null,
  color: "#000000",
  parent_id: null,
  permissions,
  board_position: null,
  is_deleted: false,
  created_at: new Date("2026-07-01T00:00:00.000Z"),
  updated_at: new Date("2026-07-01T00:00:00.000Z"),
});

test("does not infer wildcard permission from ADMIN role name", () => {
  assert.deepEqual(
    getEffectiveRolePermissions(role("ADMIN", { "users.read": true })),
    { "users.read": true },
  );
});

test("does not infer wildcard permission from SUPER_ADMIN role name", () => {
  assert.deepEqual(getEffectiveRolePermissions(role("SUPER_ADMIN", {})), {});
});

test("preserves an explicitly persisted wildcard permission", () => {
  assert.deepEqual(
    getEffectiveRolePermissions(role("Custom system operator", { "*": true })),
    { "*": true },
  );
});
