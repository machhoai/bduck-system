"use client";

/**
 * StockComparisonChart — Bar chart: ATP vs Quarantine vs In-Transit theo kho
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTranslation } from "@/lib/i18n";
import type { WarehouseStockComparison } from "@/utils/inventoryAggregation";

interface StockComparisonChartProps {
  data: WarehouseStockComparison[];
  loading: boolean;
}

export default function StockComparisonChart({
  data,
  loading,
}: StockComparisonChartProps) {
  const { t } = useTranslation();
  const d = t.inventoryDashboard;

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
        <Skeleton className="mb-4 h-5 w-48" variant="text" />
        <Skeleton className="h-[260px] w-full" variant="rect" />
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
      <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
        {d.stockComparison}
      </h3>

      {data.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
          {t.common.noData}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <BarChart
            data={data}
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--color-border-soft)"
            />
            <XAxis
              dataKey="warehouseName"
              tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
              axisLine={{ stroke: "var(--color-border-subtle)" }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: "var(--color-text-muted)" }}
              axisLine={{ stroke: "var(--color-border-subtle)" }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border-subtle)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                fontSize: "14px",
              }}
            />
            <Legend
              iconType="rect"
              iconSize={10}
              wrapperStyle={{ fontSize: "13px" }}
            />
            <Bar
              dataKey="atp"
              name={d.atpQuantity}
              fill="#257a3e"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="quarantine"
              name={d.quarantineQuantity}
              fill="#b42318"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="inTransit"
              name={d.inTransitQuantity}
              fill="#936000"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
