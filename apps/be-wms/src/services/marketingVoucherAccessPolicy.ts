import type { MarketingVoucherPermission } from "@bduck/shared-types";

import type { AuthorizationService } from "./authorization/index.js";
import { authorizationError } from "./authorization/index.js";

/**
 * Voucher marketing is company-wide, but the capability is assigned at the
 * actor's canonical workplace so Rules, menu admission and services agree.
 */
export const canAccessMarketingVouchers = (
  authorization: AuthorizationService,
  permission: MarketingVoucherPermission,
): boolean => {
  if (authorization.context.isSystemAdmin) return true;
  const workplaceFacilityId = authorization.context.workplaceFacilityId;
  return workplaceFacilityId !== null
    ? authorization.can(permission, workplaceFacilityId)
    : false;
};

export const assertMarketingVoucherPermission = (
  authorization: AuthorizationService,
  permission: MarketingVoucherPermission,
): void => {
  if (!canAccessMarketingVouchers(authorization, permission)) {
    throw authorizationError("AUTHORIZATION_DENIED");
  }
};
