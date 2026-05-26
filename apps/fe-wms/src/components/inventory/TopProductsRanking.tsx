"use client";

/**
 * TopProductsRanking — Top sản phẩm tồn kho nhiều/ít nhất
 *
 * ► Toggle giữa "Nhiều nhất" và "Ít nhất"
 * ► Hiển thị horizontal bar chart đơn giản bằng Tailwind
 */

import { useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTranslation } from "@/lib/i18n";
import type { ProductStockInfo } from "@/utils/inventoryAggregation";

interface TopProductsRankingProps {
  mostStocked: ProductStockInfo[];
  leastStocked: ProductStockInfo[];
  loading: boolean;
}

export default function TopProductsRanking({
  mostStocked,
  leastStocked,
  loading,
}: TopProductsRankingProps) {
  const { t } = useTranslation();
  const d = t.inventoryDashboard;
  const [tab, setTab] = useState<"most" | "least">("most");

  const data = tab === "most" ? mostStocked : leastStocked;
  const maxValue = data.length > 0 ? Math.max(...data.map((p) => p.totalQuantity), 1) : 1;

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
        <Skeleton className="mb-4 h-5 w-40" variant="text" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-8 w-full" variant="rect" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">
          {d.topProducts}
        </h3>

        {/* Tab toggle */}
        <div className="flex overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)]">
          <button
            type="button"
            onClick={() => setTab("most")}
            className={`px-3 py-1 text-[12px] font-medium transition-colors ${
              tab === "most"
                ? "bg-[var(--color-brand-primary)] text-white"
                : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)]"
            }`}
          >
            {d.topMost}
          </button>
          <button
            type="button"
            onClick={() => setTab("least")}
            className={`px-3 py-1 text-[12px] font-medium transition-colors ${
              tab === "least"
                ? "bg-[var(--color-brand-primary)] text-white"
                : "bg-[var(--color-surface-elevated)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)]"
            }`}
          >
            {d.topLeast}
          </button>
        </div>
      </div>

      {data.length === 0 ? (
        <p className="py-6 text-center text-[14px] text-[var(--color-text-muted)]">
          {t.common.noData}
        </p>
      ) : (
        <div className="space-y-2">
          {data.map((product, index) => {
            const barWidth =
              maxValue > 0
                ? Math.max((product.totalQuantity / maxValue) * 100, 2)
                : 2;

            return (
              <div key={product.productId} className="flex items-center gap-3">
                <span className="w-5 text-right text-[12px] font-medium text-[var(--color-text-muted)]">
                  {index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="mb-1 flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px] font-medium text-[var(--color-text-primary)]">
                      {product.productName}
                    </span>
                    <span className="shrink-0 text-[13px] font-semibold text-[var(--color-text-secondary)]">
                      {product.totalQuantity.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--color-surface-card)]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${barWidth}%`,
                        backgroundColor:
                          tab === "most"
                            ? "var(--color-brand-primary)"
                            : "var(--color-accent-warning)",
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
