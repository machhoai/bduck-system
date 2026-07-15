import assert from "node:assert/strict";
import test from "node:test";
import {
  planLegacyAssignment,
  planOfficeScopeConfig,
  planUserBackfill,
} from "./facilityAccessBackfillPlanner.js";
import { assertUserWorkplaceSourceSnapshot } from "./facilityAccessBackfillUserSource.js";

const now = new Date("2026-07-15T00:00:00.000Z");
const user = {
  id: "user-1",
  data: { id: "user-1", is_deleted: false },
};
const profile = {
  id: "profile-1",
  data: {
    user_id: "user-1",
    status: "ACTIVE",
    is_deleted: false,
    workplace_warehouse_id: "warehouse-c",
  },
};
const facility = {
  id: "warehouse-c",
  data: {
    id: "warehouse-c",
    type: "MAIN",
    status: "ACTIVE",
    is_deleted: false,
  },
};

test("backfills workplace only when one active profile has a valid facility", () => {
  const plan = planUserBackfill({
    user,
    profiles: [profile],
    workplaceFacility: facility,
    now,
  });
  assert.equal(plan.workplaceFacilityId, "warehouse-c");
  assert.equal(plan.patch?.workplace_facility_id, "warehouse-c");
  assert.deepEqual(plan.issues, []);
});

test("does not guess a workplace when active profiles are duplicated", () => {
  const plan = planUserBackfill({
    user,
    profiles: [profile, { ...profile, id: "profile-2" }],
    workplaceFacility: facility,
    now,
  });
  assert.equal(plan.patch, null);
  assert.equal(plan.issues[0]?.code, "DUPLICATE_ACTIVE_PROFILES");
});

test("does not overwrite an existing conflicting workplace", () => {
  const plan = planUserBackfill({
    user: {
      ...user,
      data: { ...user.data, workplace_facility_id: "store-d" },
    },
    profiles: [profile],
    workplaceFacility: facility,
    now,
  });
  assert.equal(plan.patch, null);
  assert.equal(plan.issues[0]?.code, "WORKPLACE_CONFLICT");
});

test("does not backfill a workplace that is inactive", () => {
  const plan = planUserBackfill({
    user,
    profiles: [profile],
    workplaceFacility: {
      ...facility,
      data: { ...facility.data, status: "INACTIVE" },
    },
    now,
  });
  assert.equal(plan.patch, null);
  assert.equal(plan.issues[0]?.code, "WORKPLACE_FACILITY_INACTIVE");
});

test("rejects a workplace source that changes before the transaction", () => {
  assert.throws(
    () =>
      assertUserWorkplaceSourceSnapshot({
        currentUser: user.data,
        profiles: [
          {
            ...profile,
            data: {
              ...profile.data,
              workplace_warehouse_id: "store-d",
            },
          },
        ],
        workplaceFacility: facility,
        expectedWorkplaceId: "warehouse-c",
      }),
    /WORKPLACE_SOURCE_PROFILE_CHANGED/,
  );
});

test("preserves legacy global semantics and marks the assignment direct", () => {
  const plan = planLegacyAssignment(
    {
      id: "assignment-1",
      data: { user_id: "user-1", warehouse_id: null },
    },
    now,
  );
  assert.equal(plan.patch?.scope_origin, "LEGACY_DIRECT");
  assert.equal(plan.issues[0]?.code, "LEGACY_GLOBAL_ASSIGNMENT_PRESERVED");
});

test("creates an empty selected scope for an office without inferring edges", () => {
  const plan = planOfficeScopeConfig({
    facility: {
      id: "office-a",
      data: { id: "office-a", type: "OFFICE", is_deleted: false },
    },
    existingConfig: null,
    initiatedBy: "system:migration",
    now,
  });
  assert.equal(plan.config?.scope_mode, "SELECTED");
  assert.equal(plan.config?.office_id, "office-a");
  assert.deepEqual(plan.issues, []);
});
