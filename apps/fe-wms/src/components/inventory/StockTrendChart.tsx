"use client";

/**
 * StockTrendChart — Placeholder line chart cho xu hướng tồn kho
 *
 * ► Hiện tại chưa có historical data → hiển thị placeholder
 * ► Khi Phase sau có snapshot lịch sử → replace bằng real data
 */

import { TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTranslation } from "@/lib/i18n";

interface StockTrendChartProps {
  loading: boolean;
}

export default function StockTrendChart({ loading }: StockTrendChartProps) {
  const { t } = useTranslation();
  const d = t.inventoryDashboard;

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
        <Skeleton className="mb-4 h-5 w-40" variant="text" />
        <Skeleton className="h-[200px] w-full" variant="rect" />
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-5">
      <h3 className="mb-4 text-[15px] font-semibold text-[var(--color-text-primary)]">
        {d.stockTrend}
      </h3>

      <div className="flex min-h-[200px] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)]">
          <TrendingUp
            size={22}
            strokeWidth={1.7}
            className="text-[var(--color-brand-primary)]"
          />
        </div>
        <p className="text-[14px] leading-relaxed text-[var(--color-text-muted)]">
          {d.stockTrendPlaceholder}
        </p>
      </div>
    </div>
  );
}
