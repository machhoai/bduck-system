import { fetchRevenueProductGroups } from "../repositories/revenueProductRepository.js";

import type { AuthorizationService } from "./authorization/authorizationService.js";
import { getAuthorizedRevenueWarehouseIds } from "./revenueWarehouseScope.js";

export async function getRevenueProductGroupCatalog(
  authorization: AuthorizationService,
  warehouseId: string,
) {
  getAuthorizedRevenueWarehouseIds(
    authorization,
    "LOCAL_POS",
    warehouseId,
    "revenue.read",
  );
  return fetchRevenueProductGroups();
}
