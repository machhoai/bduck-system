import type {
  DashboardKPIs,
  Inventory,
  InventoryDashboardSummary,
  Product,
  ProductStockInfo,
  ProductTypeDistribution,
  Warehouse,
  WarehouseBreakdown,
  WarehouseStockComparison,
} from "@bduck/shared-types";

const sum = (records: Inventory[], field: keyof Inventory) =>
  records.reduce((total, record) => total + Number(record[field] ?? 0), 0);

const computeKpis = (
  inventory: Inventory[],
  stores: Warehouse[],
  warehouseId: string | null,
): DashboardKPIs => ({
  warehouseCount: warehouseId ? 1 : stores.length,
  skuCount: new Set(inventory.map((record) => record.product_id)).size,
  totalQuantity: sum(inventory, "total_quantity"),
  atpQuantity: sum(inventory, "atp_quantity"),
  quarantineQuantity: sum(inventory, "quarantine_quantity"),
  inTransitQuantity: sum(inventory, "in_transit_quantity"),
  onHoldQuantity: sum(inventory, "on_hold_quantity"),
});

const buildProductRows = (
  inventory: Inventory[],
  products: Product[],
): ProductStockInfo[] => {
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );
  const quantities = new Map<string, { total: number; atp: number }>();
  inventory.forEach((record) => {
    const current = quantities.get(record.product_id) ?? { total: 0, atp: 0 };
    current.total += record.total_quantity;
    current.atp += record.atp_quantity;
    quantities.set(record.product_id, current);
  });
  return Array.from(quantities, ([productId, quantity]) => {
    const product = productsById.get(productId);
    if (!product) return null;
    return {
      productId,
      productName: product.name,
      productCode: product.code,
      totalQuantity: quantity.total,
      atpQuantity: quantity.atp,
      unitPrice: product.unit_price ?? null,
      isLowStock: quantity.atp <= 0,
    } satisfies ProductStockInfo;
  }).filter((row): row is ProductStockInfo => row !== null);
};

export const buildInventoryDashboardSummary = ({
  inventory,
  stores,
  products,
  warehouseId = null,
  generatedAt = new Date().toISOString(),
}: {
  inventory: Inventory[];
  stores: Warehouse[];
  products: Product[];
  warehouseId?: string | null;
  generatedAt?: string;
}): InventoryDashboardSummary => {
  const storeNames = new Map(stores.map((store) => [store.id, store.name]));
  const inventoryByStore = new Map<string, Inventory[]>();
  inventory.forEach((record) => {
    const records = inventoryByStore.get(record.warehouse_id) ?? [];
    records.push(record);
    inventoryByStore.set(record.warehouse_id, records);
  });

  const breakdown: WarehouseBreakdown[] = Array.from(
    inventoryByStore,
    ([storeId, records]) => ({
      warehouseId: storeId,
      warehouseName: storeNames.get(storeId) ?? storeId,
      ...computeKpis(records, stores, storeId),
    }),
  );
  const productRows = buildProductRows(inventory, products);
  const productsById = new Map(
    products.map((product) => [product.id, product]),
  );
  const quantitiesByType = new Map<string, number>();
  inventory.forEach((record) => {
    const type = String(
      productsById.get(record.product_id)?.product_type ?? "UNKNOWN",
    );
    quantitiesByType.set(
      type,
      (quantitiesByType.get(type) ?? 0) + record.total_quantity,
    );
  });
  const totalByType = Array.from(quantitiesByType.values()).reduce(
    (total, quantity) => total + quantity,
    0,
  );
  const typeDistribution: ProductTypeDistribution[] = Array.from(
    quantitiesByType,
    ([type, quantity]) => ({
      type,
      quantity,
      percentage:
        totalByType > 0 ? Math.round((quantity / totalByType) * 100) : 0,
    }),
  );
  const stockComparison: WarehouseStockComparison[] = Array.from(
    inventoryByStore,
    ([storeId, records]) => ({
      warehouseName: storeNames.get(storeId) ?? storeId,
      atp: sum(records, "atp_quantity"),
      quarantine: sum(records, "quarantine_quantity"),
      inTransit: sum(records, "in_transit_quantity"),
    }),
  );

  return {
    warehouseId,
    generatedAt,
    stores,
    kpis: computeKpis(inventory, stores, warehouseId),
    breakdown,
    lowStockProducts: productRows
      .filter((product) => product.isLowStock)
      .sort((left, right) => left.atpQuantity - right.atpQuantity)
      .slice(0, 100),
    topMost: [...productRows]
      .sort((left, right) => right.totalQuantity - left.totalQuantity)
      .slice(0, 10),
    topLeast: [...productRows]
      .sort((left, right) => left.totalQuantity - right.totalQuantity)
      .slice(0, 10),
    typeDistribution,
    stockComparison,
  };
};
