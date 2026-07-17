import { WarehouseType, type OfficeScopeOverviewItem } from "@bduck/shared-types";
import {
  countActiveEmployeesByOfficeIds,
  findActiveOfficeScopeEdgesByOfficeIds,
  findOfficeScopeConfigsByOfficeIds,
} from "../repositories/officeScopeOverviewRepository.js";
import { warehouseRepository } from "../repositories/warehouseRepository.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  buildOfficeScopeOverview,
  createOfficeScopeOverviewReadScope,
} from "./officeScopeOverviewPolicy.js";

export const fetchOfficeScopeOverview = async (
  authorization: AuthorizationService,
): Promise<OfficeScopeOverviewItem[]> => {
  const readScope = createOfficeScopeOverviewReadScope(authorization);
  const facilities = await warehouseRepository.findWarehousesScoped(readScope);
  const officeIds = facilities
    .filter((facility) => facility.type === WarehouseType.OFFICE)
    .map((office) => office.id);

  if (officeIds.length === 0) return [];

  const [configs, edges, employeeCounts] = await Promise.all([
    findOfficeScopeConfigsByOfficeIds(officeIds),
    findActiveOfficeScopeEdgesByOfficeIds(officeIds),
    countActiveEmployeesByOfficeIds(officeIds),
  ]);
  return buildOfficeScopeOverview({
    facilities,
    configs,
    edges,
    employeeCounts,
  });
};
