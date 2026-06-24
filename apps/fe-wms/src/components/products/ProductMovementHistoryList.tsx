"use client";

import type { Warehouse, WarehouseLocation } from "@bduck/shared-types";
import type { ProductMovementRecord } from "@/hooks/useProductMovementHistory";
import type { Dictionary } from "@/lib/i18n";
import {
  formatProductDetailDate,
  formatProductDetailNumber,
} from "@/utils/productDetailFormat";

export function ProductMovementHistoryList({
  records,
  loading,
  warehouses,
  locations,
  labels,
}: {
  records: ProductMovementRecord[];
  loading: boolean;
  warehouses: Warehouse[];
  locations: WarehouseLocation[];
  labels: Dictionary["productDetail"];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
        {labels.movementHistory}
      </h3>
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-14 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-card)]"
            />
          ))}
        </div>
      ) : records.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] p-4 text-sm text-[var(--color-text-muted)]">
          {labels.noHistory}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {records.slice(0, 20).map((record) => {
            const warehouse = warehouses.find(
              (item) => item.id === record.warehouseId,
            );
            const location = locations.find(
              (item) => item.id === record.locationId,
            );
            return (
              <div
                key={record.id}
                className="grid grid-cols-1 gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] bg-[var(--color-surface-pearl)] p-3 md:grid-cols-[0.8fr_1.1fr_0.8fr]"
              >
                <div>
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xxs font-semibold ${
                      record.type === "import"
                        ? "bg-green-100 text-green-700"
                        : "bg-blue-100 text-blue-700"
                    }`}
                  >
                    {record.type === "import" ? labels.import : labels.export}
                  </span>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {formatProductDetailDate(record.date)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                    {record.voucherNumber}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {record.counterparty}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {warehouse?.code ?? record.warehouseId}
                    {location ? ` / ${location.code} - ${location.name}` : ""}
                  </p>
                </div>
                <div className="text-left md:text-right">
                  <p className="text-base font-bold text-[var(--color-text-primary)]">
                    {formatProductDetailNumber(record.quantity)}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {record.status}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
