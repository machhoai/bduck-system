"use client";

import type { RevenueOrderItem, SoldOrderGoodsItem } from "@bduck/shared-types";
import { Box, PackageSearch, ReceiptText } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

import { formatCurrency, formatNumber } from "./revenueDashboardUtils";

export function RevenueOrderList({
  rows,
  onRowClick,
}: {
  rows: RevenueOrderItem[];
  onRowClick: (id: string) => void;
}) {
  const { t, lang } = useTranslation();
  const copy = t.revenue.orders.columns;
  if (rows.length === 0) {
    return <RevenueOrderEmptyState message={t.revenue.orders.empty} />;
  }

  return (
    <div className="divide-y divide-[var(--color-border-soft)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white">
      {rows.map((row) => (
        <button
          key={row.orderId}
          type="button"
          onClick={() => onRowClick(row.orderId)}
          className="group flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--color-brand-primary-muted)] sm:px-4"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-blue-50 text-blue-700">
              <ReceiptText size={16} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)]">
                  {row.orderNumber || row.orderId}
                </span>
                <span className="hidden rounded-full bg-emerald-50 px-2 py-0.5 text-xxs font-bold text-emerald-700 sm:inline">
                  {row.statusLabel}
                </span>
              </span>
              <span className="mt-1 block truncate text-xxs font-medium text-[var(--color-text-muted)]">
                {row.employeeName} · {formatTime(row.createTime, lang)} ·{" "}
                {row.payMethod}
              </span>
            </span>
          </span>

          <span className="shrink-0 text-right">
            <span className="block text-sm font-black tabular-nums text-[var(--color-text-primary)]">
              {formatCurrency(row.realMoney)}
            </span>
            <span className="mt-1 block text-xxs font-semibold text-[var(--color-text-muted)]">
              {copy.qty}: {formatNumber(row.totalQty)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function RevenueSoldItemList({
  rows,
  onRowClick,
}: {
  rows: SoldOrderGoodsItem[];
  onRowClick: (id: string) => void;
}) {
  const { t, lang } = useTranslation();
  const copy = t.revenue.orders.columns;
  if (rows.length === 0) {
    return <RevenueOrderEmptyState message={t.revenue.orders.empty} />;
  }

  return (
    <div className="divide-y divide-[var(--color-border-soft)] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white">
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onRowClick(row.orderId)}
          className="group flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors hover:bg-[var(--color-brand-primary-muted)] sm:px-4"
        >
          <span className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-violet-50 text-violet-700">
              <Box size={16} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-[var(--color-text-primary)] group-hover:text-[var(--color-brand-primary)]">
                {row.goodsName}
              </span>
              <span className="mt-1 block truncate text-xxs font-medium text-[var(--color-text-muted)]">
                {row.orderNumber || row.orderId} ·{" "}
                {formatTime(row.createTime, lang)} · {row.payMethod}
              </span>
            </span>
          </span>

          <span className="shrink-0 text-right">
            <span className="block text-sm font-black tabular-nums text-[var(--color-text-primary)]">
              {formatCurrency(row.realMoney)}
            </span>
            <span className="mt-1 block text-xxs font-semibold text-[var(--color-text-muted)]">
              {copy.qty}: {formatNumber(row.qty)} · {copy.price}:{" "}
              {formatCurrency(row.price)}
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

function RevenueOrderEmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] py-12">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--color-text-muted)] shadow-sm">
        <PackageSearch size={19} aria-hidden="true" />
      </span>
      <span className="text-sm font-medium text-[var(--color-text-muted)]">
        {message}
      </span>
    </div>
  );
}

function formatTime(value: string, language: "vi" | "zh"): string {
  if (!value) return "-";
  const normalized = value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString(language === "zh" ? "zh-CN" : "vi-VN");
}
