import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Request } from "express";
import {
  FACILITY_ACCESS_POLICY_VERSION,
  UserStatus,
  WarehouseType,
  type User,
} from "@bduck/shared-types";
import {
  AuthorizationError,
  createAccessContext,
  type AuthorizationSourceSnapshot,
} from "../../services/authorization/index.js";
import {
  attachRequestAccess,
  createAuthenticatedRequestUser,
  getRequestAccessContext,
  getRequestAuthorization,
} from "./requestAccessContext.js";

const actor = {
  id: "user-1",
  status: UserStatus.ACTIVE,
  is_deleted: false,
  workplace_facility_id: "store-d",
};

const requestUser: User = {
  id: actor.id,
  username: "user.one",
  email: "user@example.com",
  password_hash: "must-not-be-attached",
  full_name: "User One",
  employee_id: "EMP-1",
  status: UserStatus.ACTIVE,
  is_deleted: false,
  created_at: new Date("2026-01-01T00:00:00.000Z"),
  updated_at: new Date("2026-07-15T00:00:00.000Z"),
  workplace_facility_id: "store-d",
  mfa_enabled: true,
};

const snapshot: AuthorizationSourceSnapshot = {
  actor,
  facilities: [],
  roles: [
    {
      id: "role-reader",
      name: "Reader",
      permissions: { "inventory.read": true },
      is_deleted: false,
    },
    {
      id: "role-unused",
      name: "Unused",
      permissions: { "inventory.write": true },
      is_deleted: false,
    },
  ],
  assignments: [
    {
      id: "assignment-reader",
      user_id: actor.id,
      warehouse_id: "store-d",
      role_id: "role-reader",
      is_active: true,
      is_deleted: false,
      scope_origin: "DIRECT",
      valid_from: "2026-01-01",
      valid_until: null,
    },
    {
      id: "assignment-unused",
      user_id: actor.id,
      warehouse_id: "store-x",
      role_id: "role-unused",
      is_active: true,
      is_deleted: false,
      scope_origin: "DIRECT",
      valid_from: "2026-01-01",
      valid_until: null,
    },
  ],
  officeScopeConfigs: [],
  officeScopeEdges: [],
};

const context = createAccessContext({
  actorId: actor.id,
  workplaceFacilityId: "store-d",
  isSystemAdmin: false,
  policyVersion: FACILITY_ACCESS_POLICY_VERSION,
  computedAt: new Date("2026-07-15T00:00:00.000Z"),
  grants: [
    {
      facilityId: "store-d",
      facilityType: WarehouseType.STORE,
      permissions: { "inventory.read": true },
      sources: [
        {
          type: "DIRECT",
          role_id: "role-reader",
          assignment_id: "assignment-reader",
          office_id: null,
        },
      ],
    },
  ],
});

describe("requestAccessContext", () => {
  it("derives compatibility fields only from validated context sources", () => {
    const user = createAuthenticatedRequestUser(snapshot, context, requestUser);

    assert.equal(user.id, actor.id);
    assert.equal(user.uid, actor.id);
    assert.equal(user.email, requestUser.email);
    assert.equal(Object.hasOwn(user, "password_hash"), false);
    assert.deepEqual(user.roleIds, ["role-reader"]);
    assert.deepEqual(user.roleNames, ["Reader"]);
    assert.deepEqual(
      user.roleAssignments.map((assignment) => assignment.id),
      ["assignment-reader"],
    );
    assert.equal(Object.hasOwn(user, "permissions"), false);
  });

  it("attaches only factory-issued context for middleware consumption", () => {
    const req = {} as Request;
    attachRequestAccess(req, context);

    assert.equal(getRequestAccessContext(req), context);
    assert.equal(
      getRequestAuthorization(req)?.can("inventory.read", "store-d"),
      true,
    );

    const forged = {} as Request;
    Object.defineProperty(forged, "accessContext", {
      value: Object.freeze({ actorId: actor.id, grants: {} }),
    });
    assert.equal(getRequestAccessContext(forged), null);
    assert.throws(
      () =>
        attachRequestAccess(
          {} as Request,
          Object.freeze({ actorId: actor.id, grants: {} }) as never,
        ),
      AuthorizationError,
    );
  });

  it("rejects an actor/context identity mismatch", () => {
    assert.throws(
      () =>
        createAuthenticatedRequestUser(
          { ...snapshot, actor: { ...actor, id: "user-2" } },
          context,
          requestUser,
        ),
      AuthorizationError,
    );
  });

  it("allows a validated system admin without a canonical workplace", () => {
    const adminActor = { ...actor, workplace_facility_id: null };
    const adminSnapshot: AuthorizationSourceSnapshot = {
      ...snapshot,
      actor: adminActor,
      roles: [
        {
          id: "role-admin",
          name: "System operator",
          permissions: { "*": true },
          is_deleted: false,
        },
      ],
      assignments: [
        {
          id: "assignment-admin",
          user_id: actor.id,
          warehouse_id: null,
          role_id: "role-admin",
          is_active: true,
          is_deleted: false,
          scope_origin: "DIRECT",
          valid_from: "2026-01-01",
          valid_until: null,
        },
      ],
    };
    const adminContext = createAccessContext({
      actorId: actor.id,
      workplaceFacilityId: null,
      isSystemAdmin: true,
      systemAdminSources: [
        {
          type: "SYSTEM_GLOBAL",
          role_id: "role-admin",
          assignment_id: "assignment-admin",
          office_id: null,
        },
      ],
      policyVersion: FACILITY_ACCESS_POLICY_VERSION,
      computedAt: new Date("2026-07-15T00:00:00.000Z"),
      grants: [],
    });
    const legacyAdminUser = {
      ...requestUser,
      workplace_facility_id: "legacy-invalid-workplace",
    };

    const user = createAuthenticatedRequestUser(
      adminSnapshot,
      adminContext,
      legacyAdminUser,
    );

    assert.equal(Object.hasOwn(user, "permissions"), false);
    assert.deepEqual(user.roleIds, ["role-admin"]);
  });
});
