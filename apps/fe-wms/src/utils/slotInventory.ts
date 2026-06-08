import { StockPolicyScope } from "@bduck/shared-types";
import type {
  Inventory,
  InventoryStockPolicy,
  Product,
  WarehouseLocation,
  WarehouseLocationSlot,
  WarehouseLocationSlotProduct,
} from "@bduck/shared-types";

export interface SlotProductInventoryRow {
  warehouseId: string;
  locationId: string;
  product: Product;
  mapping: WarehouseLocationSlotProduct | null;
  slot: WarehouseLocationSlot | null;
  atp: number;
  onHold: number;
  inTransit: number;
  quarantine: number;
  total: number;
  warehousePolicy: InventoryStockPolicy | null;
  locationPolicy: InventoryStockPolicy | null;
  slotPolicy: InventoryStockPolicy | null;
}

export interface SlotInventoryGroup {
  slot: WarehouseLocationSlot | null;
  rows: SlotProductInventoryRow[];
  productCount: number;
  atp: number;
  total: number;
}

export function buildSlotInventoryGroups({
  location,
  inventory,
  products,
  slots,
  mappings,
  policies,
}: {
  location: WarehouseLocation;
  inventory: Inventory[];
  products: Product[];
  slots: WarehouseLocationSlot[];
  mappings: WarehouseLocationSlotProduct[];
  policies: InventoryStockPolicy[];
}): SlotInventoryGroup[] {
  const productById = new Map(products.map((product) => [product.id, product]));
  const slotById = new Map(slots.map((slot) => [slot.id, slot]));
  const mappingByProductId = new Map(
    mappings
      .filter((mapping) => mapping.warehouse_location_id === location.id)
      .map((mapping) => [mapping.product_id, mapping]),
  );

  const policyByKey = new Map(
    policies.map((policy) => [
      [
        policy.scope,
        policy.warehouse_id,
        policy.warehouse_location_id ?? "",
        policy.warehouse_location_slot_id ?? "",
        policy.product_id,
      ].join("::"),
      policy,
    ]),
  );

  const rows = inventory
    .filter(
      (item) =>
        item.warehouse_location_id === location.id && item.is_deleted !== true,
    )
    .map((item) => {
      const product = productById.get(item.product_id);
      if (!product) return null;

      const mapping = mappingByProductId.get(item.product_id) ?? null;
      const slot = mapping
        ? (slotById.get(mapping.warehouse_location_slot_id) ?? null)
        : null;

      return {
        warehouseId: location.warehouse_id,
        locationId: location.id,
        product,
        mapping,
        slot,
        atp: item.atp_quantity,
        onHold: item.on_hold_quantity,
        inTransit: item.in_transit_quantity,
        quarantine: item.quarantine_quantity,
        total: item.total_quantity,
        warehousePolicy:
          policyByKey.get(
            [
              StockPolicyScope.WAREHOUSE,
              location.warehouse_id,
              "",
              "",
              item.product_id,
            ].join("::"),
          ) ?? null,
        locationPolicy:
          policyByKey.get(
            [
              StockPolicyScope.LOCATION,
              location.warehouse_id,
              location.id,
              "",
              item.product_id,
            ].join("::"),
          ) ?? null,
        slotPolicy:
          slot && mapping
            ? (policyByKey.get(
                [
                  StockPolicyScope.SLOT,
                  location.warehouse_id,
                  location.id,
                  slot.id,
                  item.product_id,
                ].join("::"),
              ) ?? null)
            : null,
      } satisfies SlotProductInventoryRow;
    })
    .filter((row): row is SlotProductInventoryRow => Boolean(row))
    .sort((a, b) => b.total - a.total);

  const groups = new Map<string, SlotInventoryGroup>();
  const unassignedKey = "__unassigned__";

  for (const slot of slots) {
    groups.set(slot.id, {
      slot,
      rows: [],
      productCount: 0,
      atp: 0,
      total: 0,
    });
  }

  groups.set(unassignedKey, {
    slot: null,
    rows: [],
    productCount: 0,
    atp: 0,
    total: 0,
  });

  for (const row of rows) {
    const key = row.slot?.id ?? unassignedKey;
    const group = groups.get(key);
    if (!group) continue;

    group.rows.push(row);
    group.productCount += 1;
    group.atp += row.atp;
    group.total += row.total;
  }

  return Array.from(groups.values());
}

export function isBelowMin(
  quantity: number,
  policy: InventoryStockPolicy | null,
): boolean {
  return Boolean(policy?.is_active && quantity < policy.min_stock_quantity);
}
