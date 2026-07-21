import type { Warehouse } from "./master-data.js";

export interface DashboardKPIs {
  warehouseCount: number;
  skuCount: number;
  totalQuantity: number;
  atpQuantity: number;
  quarantineQuantity: number;
  inTransitQuantity: number;
  onHoldQuantity: number;
}

export interface WarehouseBreakdown extends DashboardKPIs {
  warehouseId: string;
  warehouseName: string;
}

export interface ProductStockInfo {
  productId: string;
  productName: string;
  productCode: string;
  totalQuantity: number;
  atpQuantity: number;
  unitPrice: number | null;
  isLowStock: boolean;
}

export interface ProductTypeDistribution {
  type: string;
  quantity: number;
  percentage: number;
}

export interface WarehouseStockComparison {
  warehouseName: string;
  atp: number;
  quarantine: number;
  inTransit: number;
}

export interface InventoryDashboardSummary {
  warehouseId: string | null;
  generatedAt: string;
  stores: Warehouse[];
  kpis: DashboardKPIs;
  breakdown: WarehouseBreakdown[];
  lowStockProducts: ProductStockInfo[];
  topMost: ProductStockInfo[];
  topLeast: ProductStockInfo[];
  typeDistribution: ProductTypeDistribution[];
  stockComparison: WarehouseStockComparison[];
}
