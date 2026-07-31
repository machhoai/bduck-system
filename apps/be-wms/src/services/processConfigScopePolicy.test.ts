import assert from "node:assert/strict";
import test from "node:test";

import type {
  ApprovalLevel,
  UserWarehouseRole,
} from "@bduck/shared-types";

import {
  assertProcessConfigScopesAllowed,
  collectGlobalRoleIds,
  findMissingActiveGlobalRoleIds,
} from "./processConfigScopePolicy.js";

const level = (
  scope: ApprovalLevel["approval_scope"],
  roleId = "role-a",
): ApprovalLevel => ({
  level: 0,
  role_id: roleId,
  label: { vi: "Duyệt", zh: "审批" },
  required: true,
  enabled: true,
  min_approvers: 1,
  approval_scope: scope,
  allow_global_fallback: false,
});

const assignment = (
  id: string,
  warehouseId: string | null,
  roleId = "role-a",
): UserWarehouseRole => ({
  id,
  user_id: `user-${id}`,
  warehouse_id: warehouseId,
  role_id: roleId,
  assigned_by: "admin",
  valid_from: "2026-01-01",
  valid_until: null,
  is_active: true,
  is_deleted: false,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
});

test("source and destination scopes are restricted to transfer configs", () => {
  assert.throws(
    () =>
      assertProcessConfigScopesAllowed(
        "IMPORT_VOUCHER",
        [level("SOURCE_WAREHOUSE")],
        {},
      ),
    (error: unknown) => (error as { statusCode?: number }).statusCode === 400,
  );
  assert.doesNotThrow(() =>
    assertProcessConfigScopesAllowed(
      "TRANSFER_ORDER",
      [level("DESTINATION_WAREHOUSE")],
      {},
    ),
  );
});

test("every configured GLOBAL level requires a global role assignment", () => {
  const disabledGlobal = {
    ...level("GLOBAL", "role-disabled"),
    required: false,
    enabled: false,
  };
  assert.deepEqual(
    collectGlobalRoleIds({
      approvalChain: [level("GLOBAL"), disabledGlobal],
      stepOptions: {},
    }),
    ["role-a", "role-disabled"],
  );
});

test("warehouse assignments do not satisfy GLOBAL scope", () => {
  const assignments = [
    assignment("warehouse", "warehouse-a"),
    assignment("global-inactive-user", null),
  ];
  assert.deepEqual(
    findMissingActiveGlobalRoleIds(
      ["role-a"],
      assignments,
      new Set(["user-warehouse"]),
      new Date("2026-07-31T00:00:00.000Z"),
    ),
    ["role-a"],
  );
  assert.deepEqual(
    findMissingActiveGlobalRoleIds(
      ["role-a"],
      assignments,
      new Set(["user-global-inactive-user"]),
      new Date("2026-07-31T00:00:00.000Z"),
    ),
    [],
  );
});
