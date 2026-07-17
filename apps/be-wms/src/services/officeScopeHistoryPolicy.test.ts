import assert from "node:assert/strict";
import test from "node:test";
import {
  AuditAction,
  FACILITY_ACCESS_POLICY_VERSION,
  WarehouseType,
  type AuditLog,
} from "@bduck/shared-types";
import {
  AuthorizationService,
  createAccessContext,
} from "./authorization/index.js";
import {
  assertCanReadOfficeScopeHistory,
  buildOfficeScopeHistory,
} from "./officeScopeHistoryPolicy.js";

const now = new Date("2026-07-17T08:00:00.000Z");
const audit = (overrides: Partial<AuditLog> = {}): AuditLog => ({
  id: "office-a_scope_revision_2",
  entity_type: "office_scope_configs",
  entity_id: "office-a",
  warehouse_id: "office-a",
  action: AuditAction.UPDATE,
  user_id: "admin",
  user_name: "System Admin",
  action_time: now,
  sync_time: new Date("2026-07-17T08:00:01.000Z"),
  old_value: {
    config: { scope_mode: "SELECTED", revision: 1 },
    target_facility_ids: ["warehouse-c"],
  },
  new_value: {
    config: { scope_mode: "SELECTED", revision: 2 },
    target_facility_ids: ["store-d"],
    affected_employee_count: 4,
  },
  ip_address: null,
  device_id: null,
  session_token: null,
  notes: null,
  ...overrides,
});

test("maps an Office revision without exposing arbitrary audit payload", () => {
  const history = buildOfficeScopeHistory([audit()], "office-a");
  assert.equal(history.length, 1);
  assert.deepEqual(history[0].added_facility_ids, ["store-d"]);
  assert.deepEqual(history[0].removed_facility_ids, ["warehouse-c"]);
  assert.equal(history[0].affected_employee_count, 4);
  assert.equal("old_value" in history[0], false);
});

test("fails closed for malformed or cross-office audit records", () => {
  const malformed = audit({
    id: "bad",
    new_value: { config: { scope_mode: "INVALID", revision: 3 } },
  });
  const officeB = audit({ id: "office-b", entity_id: "office-b" });
  assert.deepEqual(
    buildOfficeScopeHistory([malformed, officeB], "office-a"),
    [],
  );
});

test("Office A history permission cannot read Office B history", () => {
  const authorization = new AuthorizationService(
    createAccessContext({
      actorId: "office-a-manager",
      workplaceFacilityId: "office-a",
      isSystemAdmin: false,
      policyVersion: FACILITY_ACCESS_POLICY_VERSION,
      computedAt: now,
      grants: [
        {
          facilityId: "office-a",
          facilityType: WarehouseType.OFFICE,
          permissions: { "office_scopes.read": true },
          sources: [
            {
              type: "DIRECT",
              role_id: "office-manager",
              assignment_id: "assignment-a",
              office_id: null,
            },
          ],
        },
      ],
    }),
  );
  assert.doesNotThrow(() =>
    assertCanReadOfficeScopeHistory(authorization, "office-a"),
  );
  assert.throws(() =>
    assertCanReadOfficeScopeHistory(authorization, "office-b"),
  );
});
