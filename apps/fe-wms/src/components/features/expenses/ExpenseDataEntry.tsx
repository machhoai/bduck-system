"use client";

/**
 * ExpenseDataEntry — Bảng nhập liệu chi phí theo kỳ kế toán
 *
 * Props-driven: nhận data, isClosed, warehouse context từ parent.
 * Tách biệt khỏi Dashboard để giao diện gọn hơn.
 */

import { useMemo, useCallback } from "react";
import {
  ExpenseCategory,
  ExpenseCostCenter,
} from "@bduck/shared-types";
import type { ExpenseItem } from "@bduck/shared-types";
import { useExpenseAuth } from "@/hooks/useExpenseAuth";
import { useTranslation } from "@/lib/i18n";
import StandardExpenseCell from "./StandardExpenseCell";
import SemiAutoExpenseCell from "./SemiAutoExpenseCell";
import { gooeyToast } from "goey-toast";
import { Info } from "lucide-react";

interface CategoryConfig {
  key: ExpenseCategory;
  costCenter: ExpenseCostCenter;
  isSemiAuto: boolean;
}

const CATEGORY_CONFIGS: CategoryConfig[] = [
  { key: ExpenseCategory.RENT, costCenter: ExpenseCostCenter.OPERATIONS, isSemiAuto: false },
  { key: ExpenseCategory.ELECTRICITY, costCenter: ExpenseCostCenter.OPERATIONS, isSemiAuto: false },
  { key: ExpenseCategory.WATER, costCenter: ExpenseCostCenter.OPERATIONS, isSemiAuto: false },
  { key: ExpenseCategory.TRASH_COLLECTION, costCenter: ExpenseCostCenter.OPERATIONS, isSemiAuto: false },
  { key: ExpenseCategory.DRINKING_WATER, costCenter: ExpenseCostCenter.OPERATIONS, isSemiAuto: false },
  { key: ExpenseCategory.SOCIAL_INSURANCE, costCenter: ExpenseCostCenter.HR, isSemiAuto: false },
  { key: ExpenseCategory.SALARY_FULLTIME, costCenter: ExpenseCostCenter.HR, isSemiAuto: false },
  { key: ExpenseCategory.SALARY_PARTTIME, costCenter: ExpenseCostCenter.HR, isSemiAuto: false },
  { key: ExpenseCategory.MARKETING, costCenter: ExpenseCostCenter.MARKETING, isSemiAuto: false },
  { key: ExpenseCategory.GIFT_EXPENSE, costCenter: ExpenseCostCenter.MARKETING, isSemiAuto: true },
  { key: ExpenseCategory.COGS, costCenter: ExpenseCostCenter.MARKETING, isSemiAuto: true },
  { key: ExpenseCategory.CONSUMABLE_SUPPLIES, costCenter: ExpenseCostCenter.OTHERS, isSemiAuto: false },
  { key: ExpenseCategory.OTHERS, costCenter: ExpenseCostCenter.OTHERS, isSemiAuto: false },
];

function formatCurrency(value: number): string {
  return `${value.toLocaleString("vi-VN")} đ`;
}

function getVarianceClass(variance: number): string {
  if (variance > 10) return "border-accent-error/20 bg-accent-error/10 text-accent-error";
  if (variance < -10) return "border-accent-success/20 bg-accent-success/10 text-accent-success";
  return "border-border-subtle bg-surface-card text-text-muted";
}

function getVarianceDotClass(variance: number): string {
  if (variance > 10) return "bg-accent-error";
  if (variance < -10) return "bg-accent-success";
  return "bg-border-subtle";
}

// ─────────────────────────────────────────────
// Row Component
// ─────────────────────────────────────────────

function ExpenseRow({
  config,
  item,
  warehouseId,
  isClosed,
  onSave,
  label,
}: {
  config: CategoryConfig;
  item: ExpenseItem | undefined;
  warehouseId: string;
  isClosed: boolean;
  onSave: (category: ExpenseCategory, data: Partial<ExpenseItem>) => void;
  label: string;
}) {
  const { canWrite } = useExpenseAuth(warehouseId, config.key);
  const effectiveCanWrite = canWrite && !isClosed;

  const actualAmount = item?.actual_amount ?? 0;
  const budgetAmount = item?.budget_amount ?? 0;
  const suggestedAmount = item?.suggested_amount ?? null;
  const variance = budgetAmount > 0
    ? ((actualAmount - budgetAmount) / budgetAmount) * 100
    : 0;
  const usage = budgetAmount > 0 ? Math.min(Math.abs(variance), 100) : 0;

  const handleActualSave = useCallback(
    (value: number) => onSave(config.key, { actual_amount: value }),
    [config.key, onSave],
  );

  const handleBudgetSave = useCallback(
    (value: number) => onSave(config.key, { budget_amount: value }),
    [config.key, onSave],
  );

  return (
    <tr className="group border-b border-[var(--color-border-soft)] transition-colors hover:bg-[var(--color-surface-card)]">
      <td className="sticky left-0 z-10 bg-[var(--color-surface-elevated)] p-2 text-sm font-medium text-[var(--color-text-primary)] transition-colors group-hover:bg-[var(--color-surface-card)]">
        <div className="flex min-w-44 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-radius-pill ${getVarianceDotClass(variance)}`} />
          <span className="truncate">{label}</span>
        </div>
      </td>
      <td className="p-1.5 align-middle">
        <StandardExpenseCell
          value={budgetAmount}
          canWrite={effectiveCanWrite}
          onSave={handleBudgetSave}
        />
      </td>
      <td className="p-1.5 align-middle">
        {config.isSemiAuto ? (
          <SemiAutoExpenseCell
            value={actualAmount}
            suggestedAmount={suggestedAmount}
            canWrite={effectiveCanWrite}
            onSave={handleActualSave}
          />
        ) : (
          <StandardExpenseCell
            value={actualAmount}
            canWrite={effectiveCanWrite}
            onSave={handleActualSave}
          />
        )}
      </td>
      <td className="p-1.5 text-right align-middle">
        {budgetAmount > 0 ? (
          <div className="ml-auto flex min-w-24 flex-col items-end gap-1">
            <span className={`inline-flex h-6 min-w-16 items-center justify-center rounded-radius-pill border px-2 text-xxs font-bold tabular-nums ${getVarianceClass(variance)}`}>
              {variance > 0 ? "+" : ""}
              {variance.toFixed(1)}%
            </span>
            <div className="h-1 w-full overflow-hidden rounded-radius-pill bg-surface-base">
              <div
                className={`h-full rounded-radius-pill ${variance > 10 ? "bg-accent-error" : "bg-accent-success"}`}
                style={{ width: `${usage}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="text-text-muted">-</span>
        )}
      </td>
    </tr>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

interface ExpenseDataEntryProps {
  warehouseId: string;
  period: string;
  isClosed: boolean;
  data: {
    items: Record<string, ExpenseItem | undefined>;
  };
  onSaveItem: (category: ExpenseCategory, itemData: Partial<ExpenseItem>) => Promise<void>;
  warehouseName: string;
}

export default function ExpenseDataEntry({
  warehouseId,
  period,
  isClosed,
  data,
  onSaveItem,
  warehouseName,
}: ExpenseDataEntryProps) {
  const { t } = useTranslation();

  const grouped = useMemo(() => {
    const map = new Map<ExpenseCostCenter, CategoryConfig[]>();
    for (const config of CATEGORY_CONFIGS) {
      const list = map.get(config.costCenter) || [];
      list.push(config);
      map.set(config.costCenter, list);
    }
    return map;
  }, []);

  const handleSaveItem = useCallback(
    async (category: ExpenseCategory, itemData: Partial<ExpenseItem>) => {
      try {
        await gooeyToast.promise(
          onSaveItem(category, itemData),
          {
            loading: t.expenses.actions.saving,
            success: t.expenses.actions.saved,
            error: t.expenses.actions.saveFailed,
          },
        );
      } catch (err) {
        console.error("[ExpenseDataEntry] save error:", err);
      }
    },
    [onSaveItem, t],
  );

  const totalActual = useMemo(() => {
    return Object.values(data.items).reduce(
      (sum, item) => sum + (item?.actual_amount ?? 0),
      0,
    );
  }, [data.items]);

  const totalBudget = useMemo(() => {
    return Object.values(data.items).reduce(
      (sum, item) => sum + (item?.budget_amount ?? 0),
      0,
    );
  }, [data.items]);

  const totalVariance = totalBudget > 0
    ? ((totalActual - totalBudget) / totalBudget) * 100
    : 0;

  // Consolidated mode: read-only hint
  if (warehouseId === "ALL") {
    return (
      <div className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-accent-info/20 bg-accent-info/5 p-4">
        <Info size={16} className="shrink-0 text-accent-info" />
        <span className="text-xs text-text-secondary">
          {t.expenses.hint.selectWarehouse}
        </span>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t.expenses.title}
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
            {period} · {warehouseName}
          </p>
        </div>
        <span className={`inline-flex h-6 items-center rounded-[var(--radius-pill)] border px-2 text-xxs font-bold tabular-nums ${getVarianceClass(totalVariance)}`}>
          {totalBudget > 0 ? `${totalVariance > 0 ? "+" : ""}${totalVariance.toFixed(1)}%` : "-"}
        </span>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]">
              <th className="sticky left-0 z-20 bg-[var(--color-surface-card)] p-2 text-left text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t.expenses.columns.category}
              </th>
              <th className="w-44 p-2 text-left text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t.expenses.columns.budget}
              </th>
              <th className="w-56 p-2 text-left text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t.expenses.columns.actual}
              </th>
              <th className="w-32 p-2 text-right text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                {t.expenses.columns.variance}
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from(grouped.entries()).map(([costCenter, configs]) => {
              const centerLabel = t.expenses.costCenter[costCenter] || costCenter;
              const centerBudget = configs.reduce(
                (sum, config) => sum + (data.items[config.key]?.budget_amount ?? 0),
                0,
              );
              const centerActual = configs.reduce(
                (sum, config) => sum + (data.items[config.key]?.actual_amount ?? 0),
                0,
              );
              const centerVariance = centerBudget > 0
                ? ((centerActual - centerBudget) / centerBudget) * 100
                : 0;

              return [
                <tr key={`header-${costCenter}`} className="border-y border-border-subtle bg-surface-base">
                  <td className="sticky left-0 z-10 bg-surface-base p-2 text-xxs font-bold uppercase tracking-widest text-text-muted">
                    {centerLabel}
                  </td>
                  <td className="p-2 text-xxs font-semibold tabular-nums text-text-muted">
                    {formatCurrency(centerBudget)}
                  </td>
                  <td className="p-2 text-xxs font-semibold tabular-nums text-text-muted">
                    {formatCurrency(centerActual)}
                  </td>
                  <td className="p-2 text-right">
                    <span className={`inline-flex h-5 min-w-14 items-center justify-center rounded-radius-pill border px-1.5 text-micro font-bold tabular-nums ${getVarianceClass(centerVariance)}`}>
                      {centerBudget > 0 ? `${centerVariance > 0 ? "+" : ""}${centerVariance.toFixed(1)}%` : "-"}
                    </span>
                  </td>
                </tr>,
                ...configs.map((config) => (
                  <ExpenseRow
                    key={config.key}
                    config={config}
                    item={data.items[config.key]}
                    warehouseId={warehouseId}
                    isClosed={isClosed}
                    onSave={handleSaveItem}
                    label={t.expenses.category[config.key] || config.key}
                  />
                )),
              ];
            })}

            <tr className="border-t-2 border-border-subtle bg-surface-card font-semibold">
              <td className="sticky left-0 z-10 bg-surface-card p-2 text-sm text-text-primary">
                {t.expenses.total}
              </td>
              <td className="p-2 text-sm tabular-nums text-text-primary">
                {formatCurrency(totalBudget)}
              </td>
              <td className="p-2 text-sm tabular-nums text-text-primary">
                {formatCurrency(totalActual)}
              </td>
              <td className="p-2 text-right">
                {totalBudget > 0 ? (
                  <span className={`inline-flex h-6 min-w-16 items-center justify-center rounded-radius-pill border px-2 text-xxs font-bold tabular-nums ${getVarianceClass(totalVariance)}`}>
                    {totalVariance > 0 ? "+" : ""}
                    {totalVariance.toFixed(1)}%
                  </span>
                ) : (
                  <span className="text-text-muted">-</span>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
