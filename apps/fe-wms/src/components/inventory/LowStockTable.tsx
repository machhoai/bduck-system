"use client";

/**
 * LowStockTable — Bảng cảnh báo sản phẩm sắp hết hàng
 *
 * ► Chỉ hiển thị sản phẩm có isLowStock = true
 * ► Phân loại: critical (ATP = 0), warning (ATP <= threshold)
 */

import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTranslation } from "@/lib/i18n";
import type { ProductStockInfo } from "@/utils/inventoryAggregation";

interface LowStockTableProps {
  products: ProductStockInfo[];
  loading: boolean;
}

export default function LowStockTable({
  products,
  loading,
}: LowStockTableProps) {
  const { t } = useTranslation();
  const d = t.inventoryDashboard;

  const lowStockItems = products
    .filter((p) => p.isLowStock)
    .sort((a, b) => a.atpQuantity - b.atpQuantity);

  if (loading) {
    return (
      <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
        <Skeleton className="mb-4 h-5 w-48" variant="text" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="mb-2 h-8 w-full" variant="rect" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
      <div className="mb-4 flex items-center gap-2">
        <AlertTriangle
          size={18}
          strokeWidth={1.7}
          className="text-[var(--color-accent-warning)]"
        />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {d.lowStockAlerts}
        </h3>
        {lowStockItems.length > 0 && (
          <span className="ml-auto rounded-full bg-[var(--color-accent-error)] px-2 py-0.5 text-xxs font-medium text-white">
            {lowStockItems.length}
          </span>
        )}
      </div>

      {lowStockItems.length === 0 ? (
        <p className="py-4 text-center text-sm text-[var(--color-text-muted)]">
          {d.lowStockEmpty}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--color-border-soft)]">
                <th className="pb-2 pr-4 text-left font-medium text-[var(--color-text-muted)]">
                  {d.productName}
                </th>
                <th className="pb-2 pr-4 text-left font-medium text-[var(--color-text-muted)]">
                  {d.productCode}
                </th>
                <th className="pb-2 pr-4 text-right font-medium text-[var(--color-text-muted)]">
                  {d.atp}
                </th>
                <th className="pb-2 pr-4 text-right font-medium text-[var(--color-text-muted)]">
                  Đơn giá
                </th>
                <th className="pb-2 text-center font-medium text-[var(--color-text-muted)]">
                  {d.status}
                </th>
              </tr>
            </thead>
            <tbody>
              {lowStockItems.map((item) => {
                const isCritical = item.atpQuantity === 0;
                return (
                  <tr
                    key={item.productId}
                    className="border-b border-[var(--color-border-soft)] last:border-0"
                  >
                    <td className="py-2.5 pr-4 text-[var(--color-text-primary)]">
                      {item.productName}
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--color-text-muted)]">
                      {item.productCode}
                    </td>
                    <td
                      className={`py-2.5 pr-4 text-right font-medium ${
                        isCritical
                          ? "text-[var(--color-accent-error)]"
                          : "text-[var(--color-accent-warning)]"
                      }`}
                    >
                      {item.atpQuantity.toLocaleString()}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-[var(--color-text-muted)]">
                      {item.unitPrice != null
                        ? `${new Intl.NumberFormat("vi-VN").format(item.unitPrice)} đ`
                        : "—"}
                    </td>
                    <td className="py-2.5 text-center">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xxs font-medium ${
                          isCritical
                            ? "bg-[#b423181a] text-[var(--color-accent-error)]"
                            : "bg-[#9360001a] text-[var(--color-accent-warning)]"
                        }`}
                      >
                        {isCritical ? d.critical : d.warning}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
