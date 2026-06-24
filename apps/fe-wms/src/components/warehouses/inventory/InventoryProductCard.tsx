"use client";

/**
 * InventoryProductCard — Wrapper dùng shared ProductCard với variant="inventory"
 *
 * Chuyển dữ liệu từ InventoryRow sang props của ProductCard.
 * Mọi RBAC price check được xử lý bên trong ProductCard.
 */

import type { InventoryRow } from "@/hooks/useInventoryFilter";
import type { InventoryStockPolicy } from "@bduck/shared-types";
import { ProductCard } from "@/components/products/ProductCard";

interface InventoryProductCardProps {
  row: InventoryRow;
  warehousePolicy?: InventoryStockPolicy | null;
  onViewDetails?: (row: InventoryRow) => void;
}

export function InventoryProductCard({
  row,
  warehousePolicy,
  onViewDetails,
}: InventoryProductCardProps) {
  return (
    <ProductCard
      product={row.product}
      variant="inventory"
      stockInfo={{
        atp: row.atp,
        onHold: row.onHold,
        inTransit: row.inTransit,
        quarantine: row.quarantine,
        total: row.total,
      }}
      stockLocations={row.locations}
      stockPolicy={warehousePolicy}
      onViewDetails={onViewDetails ? () => onViewDetails(row) : undefined}
    />
  );
}
