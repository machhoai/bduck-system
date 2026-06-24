"use client";

import { useMemo } from "react";
import type { Dictionary } from "@/lib/i18n";
import type { ProductStockSummary, ProductStockPlacement } from "@/utils/productStockDetail";
import { formatProductDetailNumber } from "@/utils/productDetailFormat";

export function ProductStockPlacementList({
  stockSummary,
  labels,
}: {
  stockSummary: ProductStockSummary;
  labels: Dictionary["productDetail"];
}) {
  const groupedByWarehouse = useMemo(() => {
    const groups = new Map<
      string,
      {
        warehouseId: string;
        warehouseCode: string;
        warehouseName: string;
        total: number;
        atp: number;
        onHold: number;
        inTransit: number;
        quarantine: number;
        placements: ProductStockPlacement[];
      }
    >();

    for (const placement of stockSummary.placements) {
      let group = groups.get(placement.warehouseId);
      if (!group) {
        group = {
          warehouseId: placement.warehouseId,
          warehouseCode: placement.warehouseCode,
          warehouseName: placement.warehouseName,
          total: 0,
          atp: 0,
          onHold: 0,
          inTransit: 0,
          quarantine: 0,
          placements: [],
        };
        groups.set(placement.warehouseId, group);
      }
      group.total += placement.total;
      group.atp += placement.atp;
      group.onHold += placement.onHold;
      group.inTransit += placement.inTransit;
      group.quarantine += placement.quarantine;
      group.placements.push(placement);
    }

    return Array.from(groups.values());
  }, [stockSummary.placements]);

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
        {labels.stockByLocation}
      </h3>
      {stockSummary.placements.length === 0 ? (
        <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] p-4 text-sm text-[var(--color-text-muted)]">
          {labels.noStock}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {groupedByWarehouse.map((group) => (
            <div
              key={group.warehouseId}
              className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-white shadow-sm"
            >
              {/* Tiêu đề & Tổng kết kho */}
              <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface-pearl)] p-3">
                <p className="mb-1 text-xxs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">
                  {labels.warehouse}
                </p>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--color-brand-primary)]">
                    {group.warehouseCode} - {group.warehouseName}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="flex items-center gap-1 rounded bg-[var(--color-surface-card)] px-2 py-0.5">
                      <span className="text-[var(--color-text-muted)]">{labels.totalStock}:</span>
                      <span className="font-semibold">{formatProductDetailNumber(group.total)}</span>
                    </span>
                    <span className="flex items-center gap-1 rounded bg-green-50 px-2 py-0.5 text-green-700">
                      <span>{labels.atp}:</span>
                      <span className="font-semibold">{formatProductDetailNumber(group.atp)}</span>
                    </span>
                    <span className="flex items-center gap-1 rounded bg-orange-50 px-2 py-0.5 text-orange-700">
                      <span>{labels.onHold}:</span>
                      <span className="font-semibold">{formatProductDetailNumber(group.onHold)}</span>
                    </span>
                    <span className="flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-blue-700">
                      <span>{labels.inTransit}:</span>
                      <span className="font-semibold">{formatProductDetailNumber(group.inTransit)}</span>
                    </span>
                    <span className="flex items-center gap-1 rounded bg-red-50 px-2 py-0.5 text-red-700">
                      <span>{labels.quarantine}:</span>
                      <span className="font-semibold">{formatProductDetailNumber(group.quarantine)}</span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Danh sách vị trí trong kho */}
              <div className="flex flex-col bg-white">
                {group.placements.map((placement, index) => (
                  <div
                    key={placement.id}
                    className={`grid grid-cols-1 gap-2 p-3 md:grid-cols-[1.5fr_2fr] ${
                      index < group.placements.length - 1 ? "border-b border-[var(--color-border-soft)]" : ""
                    }`}
                  >
                    <div>
                      <p className="text-xxs text-[var(--color-text-muted)]">
                        {labels.location} {placement.slotCode ? `/ ${labels.slot}` : ""}
                      </p>
                      <p className="text-sm text-[var(--color-text-primary)]">
                        {placement.locationCode} - {placement.locationName}
                      </p>
                      {placement.slotCode && (
                        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                          {placement.slotCode} - {placement.slotName}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                      <span className="flex items-center gap-1">
                        <span className="text-[var(--color-text-muted)]">{labels.totalStock}:</span>
                        <span className="font-medium">{formatProductDetailNumber(placement.total)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-[var(--color-text-muted)]">{labels.atp}:</span>
                        <span className="font-medium">{formatProductDetailNumber(placement.atp)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-[var(--color-text-muted)]">{labels.onHold}:</span>
                        <span className="font-medium">{formatProductDetailNumber(placement.onHold)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-[var(--color-text-muted)]">{labels.inTransit}:</span>
                        <span className="font-medium">{formatProductDetailNumber(placement.inTransit)}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="text-[var(--color-text-muted)]">{labels.quarantine}:</span>
                        <span className="font-medium">{formatProductDetailNumber(placement.quarantine)}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
