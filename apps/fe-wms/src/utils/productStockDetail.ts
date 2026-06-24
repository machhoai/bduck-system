"use client";

import type {
  Inventory,
  Product,
  Warehouse,
  WarehouseLocation,
  WarehouseLocationSlot,
  WarehouseLocationSlotProduct,
} from "@bduck/shared-types";

export interface ProductStockPlacement {
  id: string;
  warehouseId: string;
  warehouseName: string;
  warehouseCode: string;
  locationId: string;
  locationName: string;
  locationCode: string;
  slotId: string | null;
  slotName: string | null;
  slotCode: string | null;
  total: number;
  atp: number;
  onHold: number;
  inTransit: number;
  quarantine: number;
}

export interface ProductStockSummary {
  total: number;
  atp: number;
  onHold: number;
  inTransit: number;
  quarantine: number;
  placements: ProductStockPlacement[];
}

function buildSlotKey(locationId: string, productId: string) {
  return `${locationId}:${productId}`;
}

export function buildProductStockSummary({
  product,
  inventory,
  warehouses,
  locations,
  slots,
  slotMappings,
  warehouseId,
}: {
  product: Product;
  inventory: Inventory[];
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  slots: WarehouseLocationSlot[];
  slotMappings: WarehouseLocationSlotProduct[];
  warehouseId?: string;
}): ProductStockSummary {
  const warehouseById = new Map(warehouses.map((item) => [item.id, item]));
  const locationById = new Map(locations.map((item) => [item.id, item]));
  const slotById = new Map(slots.map((item) => [item.id, item]));
  const slotMappingByLocationProduct = new Map(
    slotMappings
      .filter(
        (item) =>
          item.product_id === product.id &&
          item.is_deleted !== true &&
          item.is_active !== false,
      )
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
      .map((item) => [
        buildSlotKey(item.warehouse_location_id, item.product_id),
        item.warehouse_location_slot_id,
      ]),
  );

  const placements = inventory
    .filter(
      (item) =>
        item.product_id === product.id &&
        item.is_deleted !== true &&
        (!warehouseId || item.warehouse_id === warehouseId),
    )
    .map<ProductStockPlacement>((item) => {
      const warehouse = warehouseById.get(item.warehouse_id);
      const location = locationById.get(item.warehouse_location_id);
      const slotId =
        slotMappingByLocationProduct.get(
          buildSlotKey(item.warehouse_location_id, item.product_id),
        ) ?? null;
      const slot = slotId ? slotById.get(slotId) : null;

      return {
        id: item.id,
        warehouseId: item.warehouse_id,
        warehouseName: warehouse?.name ?? item.warehouse_id,
        warehouseCode: warehouse?.code ?? item.warehouse_id,
        locationId: item.warehouse_location_id,
        locationName: location?.name ?? item.warehouse_location_id,
        locationCode: location?.code ?? item.warehouse_location_id,
        slotId,
        slotName: slot?.name ?? null,
        slotCode: slot?.code ?? null,
        total: Number(item.total_quantity || 0),
        atp: Number(item.atp_quantity || 0),
        onHold: Number(item.on_hold_quantity || 0),
        inTransit: Number(item.in_transit_quantity || 0),
        quarantine: Number(item.quarantine_quantity || 0),
      };
    })
    .sort((a, b) => {
      const warehouseCompare = a.warehouseCode.localeCompare(
        b.warehouseCode,
        "vi",
      );
      if (warehouseCompare !== 0) return warehouseCompare;
      const locationCompare = a.locationCode.localeCompare(
        b.locationCode,
        "vi",
      );
      if (locationCompare !== 0) return locationCompare;
      return b.total - a.total;
    });

  return placements.reduce<ProductStockSummary>(
    (summary, placement) => ({
      total: summary.total + placement.total,
      atp: summary.atp + placement.atp,
      onHold: summary.onHold + placement.onHold,
      inTransit: summary.inTransit + placement.inTransit,
      quarantine: summary.quarantine + placement.quarantine,
      placements: summary.placements,
    }),
    {
      total: 0,
      atp: 0,
      onHold: 0,
      inTransit: 0,
      quarantine: 0,
      placements,
    },
  );
}
