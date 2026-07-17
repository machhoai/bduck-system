import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { WarehouseType } from "@bduck/shared-types";
import {
  createAccessSourceFingerprint,
  createUserAccessMaterializationPlan,
  emptyMaterializedSeed,
  resolveMaterializedVersion,
  type MaterializedAccessSeed,
} from "./userAccessMaterializationPlan.js";

const directSource = {
  type: "DIRECT" as const,
  role_id: "role-manager",
  assignment_id: "assignment-a",
  office_id: null,
};

const seed = (): MaterializedAccessSeed => ({
  actorId: "user-a",
  workplaceFacilityId: "office-a",
  isSystemAdmin: false,
  systemAdminSources: [],
  policyVersion: "office-scope-v1",
  grants: [
    {
      facilityId: "store-d",
      facilityType: WarehouseType.STORE,
      permissions: { "revenue.read": true, "inventory.read": true },
      sources: [directSource],
    },
  ],
});

describe("user access materialization plan", () => {
  it("fingerprints grants independently of permission and source order", () => {
    const left = seed();
    const right: MaterializedAccessSeed = {
      ...left,
      grants: [
        {
          ...left.grants[0],
          permissions: { "inventory.read": true, "revenue.read": true },
          sources: [...left.grants[0].sources].reverse(),
        },
      ],
    };
    assert.equal(
      createAccessSourceFingerprint(left),
      createAccessSourceFingerprint(right),
    );
  });

  it("builds a complete versioned grant manifest with provenance", () => {
    const now = new Date("2026-07-15T10:00:00.000Z");
    const plan = createUserAccessMaterializationPlan({
      seed: seed(),
      versionNumber: 2,
      computedBy: "system-admin",
      actionTime: now,
      syncTime: now,
      existingMetadata: null,
    });
    assert.equal(plan.metadata.access_version, 2);
    assert.equal(plan.metadata.facility_grant_count, 1);
    assert.equal(plan.version.status, "BUILDING");
    assert.equal(plan.grants[0].facility_type, WarehouseType.STORE);
    assert.deepEqual(plan.grants[0].sources, [directSource]);
    assert.equal(plan.grants[0].access_version_id, plan.version.id);
  });

  it("materializes inactive or invalid users as an empty revocation snapshot", () => {
    const revoked = emptyMaterializedSeed("user-b", "office-b");
    const now = new Date("2026-07-15T11:00:00.000Z");
    const plan = createUserAccessMaterializationPlan({
      seed: revoked,
      versionNumber: 3,
      computedBy: "system-admin",
      actionTime: now,
      syncTime: now,
      existingMetadata: null,
    });
    assert.equal(plan.metadata.is_global_admin, false);
    assert.equal(plan.metadata.facility_grant_count, 0);
    assert.deepEqual(plan.grants, []);
  });

  it("reuses a matching building version and fails unrelated staged work", () => {
    const result = resolveMaterializedVersion(4, "same-fingerprint", [
      {
        id: "matching-building",
        status: "BUILDING",
        source_fingerprint: "same-fingerprint",
      },
      {
        id: "stale-building",
        status: "BUILDING",
        source_fingerprint: "old-fingerprint",
      },
    ]);
    assert.equal(result.versionId, "matching-building");
    assert.deepEqual(result.staleBuildingVersionIds, ["stale-building"]);
  });

  it("creates a deterministic recovery suffix after a failed attempt", () => {
    const fingerprint = "123456789012345678901234567890";
    const result = resolveMaterializedVersion(5, fingerprint, [
      {
        id: "failed-base",
        status: "FAILED",
        source_fingerprint: fingerprint,
      },
    ]);
    assert.equal(result.versionId, "access-v5-123456789012345678901234-r2");
    assert.deepEqual(result.staleBuildingVersionIds, []);
  });
});
