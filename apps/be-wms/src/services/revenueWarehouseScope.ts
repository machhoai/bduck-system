import {
  ALL_REVENUE_WAREHOUSES,
  type RevenueDataSource,
} from "@bduck/shared-types";

import { authorizationError } from "./authorization/authorizationError.js";
import type { AuthorizationService } from "./authorization/authorizationService.js";

export function getAuthorizedRevenueWarehouseIds(
  authorization: AuthorizationService,
  source: RevenueDataSource,
  warehouseId: string,
  action: "revenue.read" | "revenue.export",
): string[] {
  if (warehouseId !== ALL_REVENUE_WAREHOUSES) {
    authorization.assert(action, warehouseId);
    return [warehouseId];
  }
  if (source !== "LOCAL_POS") throw authorizationError("AUTHORIZATION_DENIED");

  const warehouseIds = authorization.facilityIdsFor("revenue.read");
  if (warehouseIds.length === 0)
    throw authorizationError("AUTHORIZATION_DENIED");
  // Never silently export a smaller scope than the all-store dashboard.
  warehouseIds.forEach((id) => authorization.assert(action, id));
  return warehouseIds;
}
