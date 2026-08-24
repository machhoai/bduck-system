import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  MARKETING_VOUCHER_PERMISSION_KEYS,
  FACILITY_ACCESS_POLICY_VERSION,
  PERMISSION_REGISTRY,
  WarehouseType,
  type FacilityAccessGrantSource,
  type MarketingVoucherPermission,
} from "@bduck/shared-types";

import {
  createAccessContext,
  AuthorizationService,
} from "./authorization/index.js";
import { canAccessMarketingVouchers } from "./marketingVoucherAccessPolicy.js";

const directSource = (facilityId: string): FacilityAccessGrantSource => ({
  type: "DIRECT",
  role_id: `role-${facilityId}`,
  assignment_id: `assignment-${facilityId}`,
  office_id: null,
});
const adminSource: FacilityAccessGrantSource = {
  type: "SYSTEM_GLOBAL",
  role_id: "role-system-admin",
  assignment_id: "assignment-system-admin",
  office_id: null,
};

const authorization = (
  workplacePermission: MarketingVoucherPermission | "*" | null,
  options: { systemAdmin?: boolean; remotePermission?: boolean } = {},
) =>
  new AuthorizationService(
    createAccessContext({
      actorId: "voucher-operator",
      workplaceFacilityId: options.systemAdmin ? null : "store-a",
      isSystemAdmin: options.systemAdmin === true,
      systemAdminSources: options.systemAdmin ? [adminSource] : [],
      policyVersion: FACILITY_ACCESS_POLICY_VERSION,
      computedAt: new Date("2026-08-20T00:00:00.000Z"),
      grants: options.systemAdmin
        ? []
        : [
            {
              facilityId: "store-a",
              facilityType: WarehouseType.STORE,
              permissions: workplacePermission
                ? { [workplacePermission]: true }
                : { "inventory.read": true },
              sources: [directSource("store-a")],
            },
            ...(options.remotePermission
              ? [
                  {
                    facilityId: "store-b",
                    facilityType: WarehouseType.STORE,
                    permissions: { "marketing_vouchers.read": true },
                    sources: [directSource("store-b")],
                  },
                ]
              : []),
          ],
    }),
  );

describe("marketing voucher access matrix", () => {
  it("registers exactly eight localized capabilities in one domain", () => {
    const definitions = PERMISSION_REGISTRY.filter(
      (permission) => permission.group === "marketing_vouchers",
    );
    assert.deepEqual(
      definitions.map((permission) => permission.key),
      [...MARKETING_VOUCHER_PERMISSION_KEYS],
    );
    definitions.forEach((permission) => {
      assert.ok(permission.label.vi && permission.label.zh);
      assert.ok(permission.description.vi && permission.description.zh);
    });
  });

  it("keeps every capability independent", () => {
    MARKETING_VOUCHER_PERMISSION_KEYS.forEach((granted) => {
      const access = authorization(granted);
      MARKETING_VOUCHER_PERMISSION_KEYS.forEach((requested) => {
        assert.equal(
          canAccessMarketingVouchers(access, requested),
          requested === granted,
          `${granted} must not imply ${requested}`,
        );
      });
    });
  });

  it("accepts explicit wildcard and materialized system admin", () => {
    const wildcard = authorization("*");
    const admin = authorization(null, { systemAdmin: true });
    MARKETING_VOUCHER_PERMISSION_KEYS.forEach((permission) => {
      assert.equal(canAccessMarketingVouchers(wildcard, permission), true);
      assert.equal(canAccessMarketingVouchers(admin, permission), true);
    });
  });

  it("fails closed when permission exists outside the canonical workplace", () => {
    const remoteOnly = authorization(null, { remotePermission: true });
    assert.equal(
      canAccessMarketingVouchers(remoteOnly, "marketing_vouchers.read"),
      false,
    );
  });
});
