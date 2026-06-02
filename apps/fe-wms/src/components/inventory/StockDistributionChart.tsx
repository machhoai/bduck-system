"use client";

/**
 * StockDistributionChart — Donut chart: phân bổ tồn kho theo ProductType
 */

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTranslation } from "@/lib/i18n";
import type { ProductTypeDistribution } from "@/utils/inventoryAggregation";

interface StockDistributionChartProps {
  data: ProductTypeDistribution[];
  loading: boolean;
}

const COLORS = ["#0066cc", "#257a3e", "#936000", "#6366f1", "#b42318"];

export default function StockDistributionChart({
  data,
  loading,
}: StockDistributionChartProps) {
  const { t } = useTranslation();
  const d = t.inventoryDashboard;
  const typeLabels = d.productTypes as Record<string, string>;

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
        <Skeleton className="mb-4 h-5 w-40" variant="text" />
        <Skeleton className="mx-auto h-[200px] w-[200px]" variant="circle" />
      </div>
    );
  }

  const chartData = data.map((item) => ({
    ...item,
    name: typeLabels[item.type] || item.type,
  }));

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
      <h3 className="mb-4 text-sm font-semibold text-[var(--color-text-primary)]">
        {d.stockDistribution}
      </h3>

      {chartData.length === 0 ? (
        <p className="py-12 text-center text-sm text-[var(--color-text-muted)]">
          {t.common.noData}
        </p>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={95}
              paddingAngle={3}
              dataKey="quantity"
              nameKey="name"
              stroke="none"
            >
              {chartData.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--color-border-subtle)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
                fontSize: "14px",
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              formatter={(value: any) => [
                Number(value).toLocaleString(),
                d.quantity,
              ]}
            />
            <Legend
              verticalAlign="bottom"
              height={36}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "13px" }}
            />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
