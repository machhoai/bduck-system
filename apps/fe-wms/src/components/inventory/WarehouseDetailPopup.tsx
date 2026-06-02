"use client";

/**
 * WarehouseDetailPopup — Modal popup hiện breakdown số liệu theo từng kho
 *
 * ► Hiển thị khi user click stat card ở chế độ "Tất cả kho"
 * ► Bảng chi tiết: mỗi dòng là 1 kho, cột tương ứng metric đang xem
 */

import { X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { WarehouseBreakdown } from "@/utils/inventoryAggregation";

interface WarehouseDetailPopupProps {
  isOpen: boolean;
  onClose: () => void;
  metric: string;
  breakdown: WarehouseBreakdown[];
}

const METRIC_KEY_MAP: Record<string, keyof WarehouseBreakdown> = {
  warehouseCount: "warehouseCount",
  skuCount: "skuCount",
  totalQuantity: "totalQuantity",
  atpQuantity: "atpQuantity",
  quarantineQuantity: "quarantineQuantity",
  inTransitQuantity: "inTransitQuantity",
  onHoldQuantity: "onHoldQuantity",
};

export default function WarehouseDetailPopup({
  isOpen,
  onClose,
  metric,
  breakdown,
}: WarehouseDetailPopupProps) {
  const { t } = useTranslation();
  const d = t.inventoryDashboard;

  if (!isOpen) return null;

  const metricKey = METRIC_KEY_MAP[metric] || "totalQuantity";

  const metricLabelMap: Record<string, string> = {
    warehouseCount: d.warehouseCount,
    skuCount: d.skuCount,
    totalQuantity: d.totalQuantity,
    atpQuantity: d.atpQuantity,
    quarantineQuantity: d.quarantineQuantity,
    inTransitQuantity: d.inTransitQuantity,
    onHoldQuantity: d.onHoldQuantity,
  };
  const metricLabel = metricLabelMap[metric] || d.totalQuantity;

  // Sort by the selected metric descending
  const sorted = [...breakdown].sort(
    (a, b) =>
      (b[metricKey] as number) - (a[metricKey] as number),
  );

  const total = sorted.reduce(
    (sum, item) => sum + (item[metricKey] as number),
    0,
  );

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 backdrop-blur-sm">
      <div className="mx-4 w-full rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-2xl sm:mx-0 sm:w-[560px]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-4">
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {d.warehouseBreakdown}
            </h3>
            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
              {metricLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        {/* Content */}
        <div className="max-h-[400px] overflow-y-auto px-4 py-4">
          {sorted.length === 0 ? (
            <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">
              {t.common.noData}
            </p>
          ) : (
            <div className="space-y-2">
              {sorted.map((item) => {
                const value = item[metricKey] as number;
                const percentage =
                  total > 0 ? Math.round((value / total) * 100) : 0;

                return (
                  <div
                    key={item.warehouseId}
                    className="flex items-center gap-3 rounded-[var(--radius-sm)] px-3 py-2.5 transition-colors hover:bg-[var(--color-surface-card)]"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                        {item.warehouseName}
                      </p>
                      {/* Mini progress bar */}
                      <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-card)]">
                        <div
                          className="h-full rounded-full bg-[var(--color-brand-primary)] transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {value.toLocaleString()}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {percentage}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer — Total */}
        <div className="flex items-center justify-between border-t border-[var(--color-border-soft)] px-4 py-3">
          <span className="text-sm font-medium text-[var(--color-text-muted)]">
            {d.totalQuantity}
          </span>
          <span className="text-sm font-bold text-[var(--color-text-primary)]">
            {total.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}
