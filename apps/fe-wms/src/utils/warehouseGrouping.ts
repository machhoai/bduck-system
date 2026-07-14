import { WarehouseType, type Warehouse } from "@bduck/shared-types";

export interface WarehouseTypeGroup {
  type: WarehouseType;
  warehouses: Warehouse[];
}

const WAREHOUSE_TYPE_ORDER = [
  WarehouseType.MAIN,
  WarehouseType.STORE,
  WarehouseType.OFFICE,
] as const;

export function groupWarehousesByType(
  warehouses: Warehouse[],
): WarehouseTypeGroup[] {
  return WAREHOUSE_TYPE_ORDER.map((type) => ({
    type,
    warehouses: warehouses.filter((warehouse) => warehouse.type === type),
  })).filter((group) => group.warehouses.length > 0);
}
