import assert from "node:assert/strict";
import test from "node:test";
import {
  FACILITY_ACCESS_POLICY_VERSION,
  UserStatus,
  WarehouseType,
  type User,
  type UserAccessMetadata,
  type UserFacilityAccessGrant,
} from "@bduck/shared-types";
import {
  buildMaterializedPermissions,
  parseActiveAccessMetadata,
} from "../lib/accessSnapshotPolicy";
import { resolveAuthenticatedDestination } from "../lib/authNavigationPolicy";
import { createReceivingDraftId } from "../lib/receivingDraftStorage";
import { useUserStore } from "../stores/useUserStore";

const now = new Date("2026-07-16T00:00:00.000Z");

function user(id: string): User {
  return {
    id,
    username: id,
    email: `${id}@example.com`,
    password_hash: "not-returned-to-client",
    full_name: id,
    employee_id: id,
    status: UserStatus.ACTIVE,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
}

function metadata(
  userId: string,
  version: number,
  versionId: string,
  grantCount: number,
): UserAccessMetadata {
  return {
    id: userId,
    user_id: userId,
    workplace_facility_id: "office-b",
    is_global_admin: false,
    system_admin_sources: [],
    active_version_id: versionId,
    access_version: version,
    policy_version: FACILITY_ACCESS_POLICY_VERSION,
    source_fingerprint: `fingerprint-${version}`,
    facility_grant_count: grantCount,
    computed_at: now,
    computed_by: "system",
    migration_version: null,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    action_time: now,
    sync_time: now,
  };
}

function grant(
  userId: string,
  facilityId: string,
  version: number,
  versionId: string,
): UserFacilityAccessGrant {
  return {
    id: facilityId,
    user_id: userId,
    facility_id: facilityId,
    facility_type: facilityId.startsWith("store")
      ? WarehouseType.STORE
      : WarehouseType.MAIN,
    permissions: { "inventory.read": true },
    sources: [],
    access_version_id: versionId,
    access_version: version,
    computed_at: now,
    is_deleted: false,
    created_at: now,
    updated_at: now,
    action_time: now,
    sync_time: now,
  };
}

test("access version revokes old listeners before applying the new scope", () => {
  const store = useUserStore.getState();
  store.clearAuth();
  store.setAuthData(user("office-b-user"));
  store.applyAccessSnapshot(1, "access-v1", {
    "warehouse-c": { "inventory.read": true },
    "store-d": { "inventory.read": true },
  });
  const readyEpoch = useUserStore.getState().accessEpoch;

  useUserStore.getState().markAccessOffline();
  assert.equal(useUserStore.getState().accessStatus, "OFFLINE_READY");
  assert.equal(
    useUserStore.getState().hasPermission("inventory.read", "warehouse-c"),
    true,
  );

  useUserStore.getState().beginAccessRefresh(2, "access-v2");
  assert.equal(useUserStore.getState().accessStatus, "VERIFYING");
  assert.deepEqual(useUserStore.getState().permissions, {});
  assert.ok(useUserStore.getState().accessEpoch > readyEpoch);

  useUserStore.getState().applyAccessSnapshot(2, "access-v2", {
    "store-d": { "inventory.read": true },
  });
  assert.equal(
    useUserStore.getState().hasPermission("inventory.read", "warehouse-c"),
    false,
  );
  assert.equal(
    useUserStore.getState().hasPermission("inventory.read", "store-d"),
    true,
  );
});

test("materialized grants reject stale versions and malformed metadata", () => {
  const activeMetadata = metadata("office-b-user", 2, "access-v2", 1);
  assert.deepEqual(
    buildMaterializedPermissions(activeMetadata, [
      grant("office-b-user", "store-d", 2, "access-v2"),
    ]),
    { "store-d": { "inventory.read": true } },
  );
  assert.throws(
    () =>
      buildMaterializedPermissions(activeMetadata, [
        grant("office-b-user", "warehouse-c", 1, "access-v1"),
      ]),
    /USER_ACCESS_GRANT_VERSION_MISMATCH/,
  );
  assert.equal(
    parseActiveAccessMetadata("office-b-user", {
      ...activeMetadata,
      user_id: "another-user",
    }),
    null,
  );
});

test("shared-device state and offline drafts stay account-isolated", () => {
  const draftA = createReceivingDraftId("office-a-user", "voucher-1");
  const draftB = createReceivingDraftId("office-b-user", "voucher-1");
  assert.notEqual(draftA, draftB);

  useUserStore.getState().clearAuth();
  useUserStore.getState().setAuthData(user("office-b-user"));
  assert.deepEqual(useUserStore.getState().permissions, {});
  assert.equal(useUserStore.getState().accessStatus, "VERIFYING");
  assert.equal(
    useUserStore.getState().hasPermission("inventory.read", "store-d"),
    false,
  );
  useUserStore.getState().clearAuth();
});

test("auth navigation waits for both session and materialized access", () => {
  const emptyPermissions = {};

  assert.equal(
    resolveAuthenticatedDestination({
      authStatus: "VERIFYING",
      isAuthenticated: false,
      accessStatus: "SIGNED_OUT",
      permissions: emptyPermissions,
    }),
    null,
  );
  assert.equal(
    resolveAuthenticatedDestination({
      authStatus: "AUTHENTICATED",
      isAuthenticated: true,
      accessStatus: "VERIFYING",
      permissions: emptyPermissions,
    }),
    null,
  );
  assert.equal(
    resolveAuthenticatedDestination({
      authStatus: "AUTHENTICATED",
      isAuthenticated: true,
      accessStatus: "READY",
      permissions: { "store-d": { "inventory.read": true } },
    }),
    "/dashboard",
  );
  assert.equal(
    resolveAuthenticatedDestination({
      authStatus: "AUTHENTICATED",
      isAuthenticated: true,
      accessStatus: "REVOKED",
      permissions: emptyPermissions,
    }),
    "/no-access",
  );
});

test("dashboard auth guard distinguishes verification from signed out", () => {
  useUserStore.getState().clearAuth();
  useUserStore.getState().beginAuthVerification("office-b-user");
  assert.equal(useUserStore.getState().authStatus, "VERIFYING");
  assert.equal(useUserStore.getState().isAuthenticated, false);

  useUserStore.getState().setAuthData(user("office-b-user"));
  assert.equal(useUserStore.getState().authStatus, "AUTHENTICATED");
  assert.equal(useUserStore.getState().isAuthenticated, true);

  useUserStore.getState().clearAuth();
  assert.equal(useUserStore.getState().authStatus, "SIGNED_OUT");
});
