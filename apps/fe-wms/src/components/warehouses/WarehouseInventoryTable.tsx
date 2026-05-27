"use client";

import { useMemo } from "react";
import type { Inventory, Product } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { Package } from "lucide-react";

interface WarehouseInventoryTableProps {
  inventory: Inventory[];
  products: Product[];
  warehouseId: string;
}

export function WarehouseInventoryTable({
  inventory,
  products,
  warehouseId,
}: WarehouseInventoryTableProps) {
  const { t } = useTranslation();

  // Aggregate inventory for this specific warehouse
  const aggregatedData = useMemo(() => {
    const productMap = new Map<
      string,
      {
        product: Product;
        atp: number;
        onHold: number;
        inTransit: number;
        quarantine: number;
      }
    >();

    const filteredInventory = inventory.filter(
      (inv) => inv.warehouse_id === warehouseId
    );

    for (const inv of filteredInventory) {
      const prod = products.find((p) => p.id === inv.product_id);
      if (!prod) continue;

      const existing = productMap.get(inv.product_id) || {
        product: prod,
        atp: 0,
        onHold: 0,
        inTransit: 0,
        quarantine: 0,
      };

      existing.atp += inv.atp_quantity;
      existing.onHold += inv.on_hold_quantity;
      existing.inTransit += inv.in_transit_quantity;
      existing.quarantine += inv.quarantine_quantity;

      productMap.set(inv.product_id, existing);
    }

    return Array.from(productMap.values()).sort(
      (a, b) => b.atp + b.onHold - (a.atp + a.onHold)
    );
  }, [inventory, products, warehouseId]);

  if (aggregatedData.length === 0) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)]">
        <Package size={24} className="mb-2 opacity-50" />
        <span className="text-sm">{t.common.noData}</span>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)]">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)]">
          <tr>
            <th className="px-4 py-3 font-medium text-[var(--color-text-secondary)]">
              {t.warehouses.code}
            </th>
            <th className="px-4 py-3 font-medium text-[var(--color-text-secondary)]">
              {t.warehouses.name}
            </th>
            <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">
              ATP
            </th>
            <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">
              On Hold
            </th>
            <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">
              In Transit
            </th>
            <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">
              Quarantine
            </th>
            <th className="px-4 py-3 text-right font-medium text-[var(--color-text-secondary)]">
              {t.inventoryDashboard.totalQuantity}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-subtle)]">
          {aggregatedData.map((item) => {
            const total =
              item.atp + item.onHold + item.inTransit + item.quarantine;
            return (
              <tr
                key={item.product.id}
                className="transition-colors hover:bg-[var(--color-surface-pearl)]"
              >
                <td className="px-4 py-3 font-medium text-[var(--color-text-primary)]">
                  {item.product.code}
                </td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                  {item.product.name}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-[var(--color-text-primary)]">
                  {item.atp.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                  {item.onHold > 0 ? item.onHold.toLocaleString() : "-"}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-secondary)]">
                  {item.inTransit > 0 ? item.inTransit.toLocaleString() : "-"}
                </td>
                <td className="px-4 py-3 text-right text-[var(--color-text-danger)]">
                  {item.quarantine > 0 ? item.quarantine.toLocaleString() : "-"}
                </td>
                <td className="px-4 py-3 text-right font-bold text-[var(--color-text-primary)]">
                  {total.toLocaleString()}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
