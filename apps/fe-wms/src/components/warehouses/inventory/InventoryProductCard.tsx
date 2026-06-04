"use client";

/**
 * InventoryProductCard — Wrapper dùng shared ProductCard với variant="inventory"
 *
 * Chuyển dữ liệu từ InventoryRow sang props của ProductCard.
 * Mọi RBAC price check được xử lý bên trong ProductCard.
 */

import type { InventoryRow } from "@/hooks/useInventoryFilter";
import { ProductCard } from "@/components/products/ProductCard";

interface InventoryProductCardProps {
    row: InventoryRow;
}

export function InventoryProductCard({ row }: InventoryProductCardProps) {
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
        />
    );
}
