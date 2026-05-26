"use client";

import { Edit3, Plus, Trash2, MapPin, PackageOpen } from "lucide-react";
import { LocationStatus } from "@bduck/shared-types";
import type { WarehouseLocation, Inventory, Product } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { WarehouseTableSkeleton } from "./WarehouseSkeleton";

interface LocationCardGridProps {
  locations: WarehouseLocation[];
  inventory: Inventory[];
  products: Product[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (location: WarehouseLocation) => void;
  onDelete: (location: WarehouseLocation) => void;
}

export function LocationCardGrid({
  locations,
  inventory,
  products,
  loading,
  onAdd,
  onEdit,
  onDelete,
}: LocationCardGridProps) {
  const { t } = useTranslation();

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-[21px] font-semibold leading-[1.19] tracking-[0.231px] text-[var(--color-text-primary)]">
            {t.warehouses.locationList}
          </h2>
          <p className="text-[17px] text-[var(--color-text-muted)]">
            {t.warehouses.locationListHint}
          </p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-brand-primary)] px-5 text-[15px] font-medium text-white shadow-sm transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95"
        >
          <Plus size={18} />
          {t.warehouses.addLocation}
        </button>
      </div>

      {loading ? (
        <WarehouseTableSkeleton />
      ) : locations.length === 0 ? (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-12 text-center">
          <MapPin size={42} className="mb-3 text-[var(--color-text-muted)]" />
          <h3 className="text-[17px] font-semibold text-[var(--color-text-primary)]">
            {t.warehouses.emptyLocations}
          </h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {locations.map((location) => {
            // Lọc inventory thuộc về location này
            const locationInventory = inventory.filter(
              (inv) => inv.location_id === location.id
            );

            // Gom nhóm theo product_id để hiển thị (tổng số lượng)
            const productMap = new Map<
              string,
              { product: Product; totalQuantity: number }
            >();

            for (const inv of locationInventory) {
              const prod = products.find((p) => p.id === inv.product_id);
              if (!prod) continue;
              const currentTotal =
                inv.atp_quantity +
                inv.on_hold_quantity +
                inv.in_transit_quantity +
                inv.quarantine_quantity;

              const existing = productMap.get(inv.product_id);
              if (existing) {
                existing.totalQuantity += currentTotal;
              } else {
                productMap.set(inv.product_id, {
                  product: prod,
                  totalQuantity: currentTotal,
                });
              }
            }

            const aggregatedProducts = Array.from(productMap.values());

            return (
              <div
                key={location.id}
                className="flex flex-col rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-sm overflow-hidden"
              >
                {/* Card Header */}
                <div className="flex items-start justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold text-[var(--color-text-primary)]">
                        {location.name}
                      </h3>
                      <StatusBadge status={location.status} />
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <span className="rounded bg-[var(--color-surface-card)] px-1.5 py-0.5 border border-[var(--color-border-soft)] font-medium">
                        {location.code}
                      </span>
                      <span>·</span>
                      <span>{t.warehouses.types[location.type]}</span>
                    </div>
                  </div>
                  <div className="ml-2 flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(location)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-brand-primary)]"
                      aria-label={t.common.edit}
                    >
                      <Edit3 size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(location)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-accent-error)]"
                      aria-label={t.common.delete}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Card Body - Inventory List */}
                <div className="flex-1 p-0">
                  {aggregatedProducts.length === 0 ? (
                    <div className="flex h-32 flex-col items-center justify-center text-center px-4">
                      <PackageOpen
                        size={24}
                        className="mb-2 text-[var(--color-text-muted)] opacity-50"
                      />
                      <p className="text-sm text-[var(--color-text-muted)]">
                        {t.common.noData}
                      </p>
                    </div>
                  ) : (
                    <div className="max-h-[250px] overflow-y-auto">
                      <ul className="divide-y divide-[var(--color-border-soft)]">
                        {aggregatedProducts.map((item) => (
                          <li
                            key={item.product.id}
                            className="flex items-center justify-between px-4 py-2.5 transition-colors hover:bg-[var(--color-surface-pearl)]"
                          >
                            <div className="min-w-0 pr-4">
                              <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                                {item.product.name}
                              </p>
                              <p className="truncate text-xs text-[var(--color-text-muted)]">
                                {item.product.code}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {item.totalQuantity.toLocaleString()}
                              </p>
                              <p className="text-[10px] uppercase text-[var(--color-text-muted)]">
                                {item.product.unit}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StatusBadge({ status }: { status: LocationStatus }) {
  const { t } = useTranslation();
  const classes =
    status === LocationStatus.ACTIVE
      ? "bg-[var(--color-surface-success)] text-[var(--color-text-success)]"
      : status === LocationStatus.QUARANTINE
        ? "bg-[var(--color-surface-warning)] text-[var(--color-accent-warning)]"
        : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]";

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${classes}`}
    >
      {t.warehouses.statuses[status]}
    </span>
  );
}
