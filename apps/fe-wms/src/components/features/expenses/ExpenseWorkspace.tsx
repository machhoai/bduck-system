"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ExpenseCategory,
  ExpenseCostCenter,
  ExpenseStatus,
} from "@bduck/shared-types";
import type { ExpenseItem } from "@bduck/shared-types";
import { useExpenses } from "@/hooks/useExpenses";
import { useExpenseAuth } from "@/hooks/useExpenseAuth";
import { useTranslation } from "@/lib/i18n";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useUserStore } from "@/stores/useUserStore";
import StandardExpenseCell from "./StandardExpenseCell";
import SemiAutoExpenseCell from "./SemiAutoExpenseCell";
import { gooeyToast } from "goey-toast";
import ExpenseDashboard from "./ExpenseDashboard";
import {
  AlertTriangle,
  Calendar,
  Info,
  Lock,
  Warehouse as WarehouseIcon,
  X,
} from "lucide-react";

/** All expense write permissions to check */
const EXPENSE_WRITE_PERMS = [
  "expenses.operations.write",
  "expenses.hr.write",
  "expenses.marketing.write",
  "expenses.others.write",
];

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

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

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

function ClosePeriodConfirm({
  onConfirm,
  onCancel,
  t,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  t: { closePeriodConfirm: string; closePeriod: string };
}) {
  return (
    <div className="flex w-full flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border border-accent-warning/30 bg-accent-warning/5 p-4">
      <AlertTriangle size={16} className="shrink-0 text-accent-warning" />
      <span className="min-w-56 flex-1 text-xs text-text-secondary">
        {t.closePeriodConfirm}
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)]"
        aria-label="Close"
      >
        <X size={13} />
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className="h-8 w-fit rounded-[var(--radius-sm)] bg-accent-error px-3 text-xs font-semibold text-text-on-dark transition-colors hover:bg-accent-error/90"
      >
        {t.closePeriod}
      </button>
    </div>
  );
}

export default function ExpenseWorkspace() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState(getCurrentPeriod);
  const [warehouseId, setWarehouseId] = useState("ALL");
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [autoSelected, setAutoSelected] = useState(false);

  const { warehouses } = useWarehouses();
  const permissions = useUserStore((s) => s.permissions);

  // Auto-select warehouse if user has write permission for only one
  useEffect(() => {
    if (autoSelected || warehouses.length === 0) return;
    const globalPerms = permissions["global"] || {};
    if (globalPerms["*"] === true) {
      setAutoSelected(true);
      return; // Admin sees ALL by default
    }
    const writableIds = warehouses.filter((wh) => {
      const whPerms = permissions[wh.id] || {};
      return EXPENSE_WRITE_PERMS.some(
        (p) => globalPerms[p] === true || whPerms[p] === true || whPerms["*"] === true,
      );
    });
    if (writableIds.length === 1) {
      setWarehouseId(writableIds[0].id);
    }
    setAutoSelected(true);
  }, [warehouses, permissions, autoSelected]);

  const { data, loading, error, updateItem, closePeriod } = useExpenses(
    warehouseId,
    period,
  );
  const { canClosePeriod } = useExpenseAuth(warehouseId);

  const isClosed = data?.status === ExpenseStatus.CLOSED;

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
          updateItem(category, itemData as Record<string, unknown>),
          {
            loading: t.expenses.actions.saving,
            success: t.expenses.actions.saved,
            error: t.expenses.actions.saveFailed,
          },
        );
      } catch (err) {
        console.error("[ExpenseWorkspace] save error:", err);
      }
    },
    [updateItem, t],
  );

  const handleClosePeriod = useCallback(async () => {
    setShowCloseConfirm(false);
    try {
      await gooeyToast.promise(closePeriod(), {
        loading: t.expenses.actions.closing,
        success: t.expenses.actions.closed,
        error: t.expenses.actions.closeFailed,
      });
    } catch (err) {
      console.error("[ExpenseWorkspace] close period error:", err);
    }
  }, [closePeriod, t]);

  const totalActual = useMemo(() => {
    if (!data?.items) return 0;
    return Object.values(data.items).reduce(
      (sum, item) => sum + (item?.actual_amount ?? 0),
      0,
    );
  }, [data?.items]);

  const totalBudget = useMemo(() => {
    if (!data?.items) return 0;
    return Object.values(data.items).reduce(
      (sum, item) => sum + (item?.budget_amount ?? 0),
      0,
    );
  }, [data?.items]);

  const totalVariance = totalBudget > 0
    ? ((totalActual - totalBudget) / totalBudget) * 100
    : 0;
  const selectedWarehouseName = warehouseId === "ALL"
    ? t.expenses.selectors.allWarehouses
    : warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? warehouseId;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-normal text-[var(--color-text-muted)]">
            {selectedWarehouseName}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-[var(--font-display)] text-lg font-semibold leading-tight tracking-normal text-[var(--color-text-primary)] lg:text-lg">
              {t.expenses.title}
            </h1>
            {data && (
              <span
                className={`inline-flex h-6 items-center gap-1 rounded-[var(--radius-pill)] px-2 text-xxs font-semibold uppercase tracking-wider ${
                  isClosed
                    ? "bg-accent-error/10 text-accent-error"
                    : "bg-accent-success/10 text-accent-success"
                }`}
              >
                {isClosed && <Lock size={10} />}
                {isClosed ? t.expenses.status.CLOSED : t.expenses.status.OPEN}
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
            {t.expenses.subtitle}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center sm:justify-end">
          <div className="relative flex items-center">
            <Calendar size={14} className="pointer-events-none absolute left-2.5 text-[var(--color-text-muted)]" />
            <input
              type="month"
              className="h-9 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-8 pr-3 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none sm:w-36"
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
            />
          </div>

          <div className="relative flex items-center">
            <WarehouseIcon size={14} className="pointer-events-none absolute left-2.5 text-[var(--color-text-muted)]" />
            <select
              className="h-9 w-full appearance-none rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-8 pr-7 text-sm text-[var(--color-text-primary)] focus:border-[var(--color-brand-primary)] focus:outline-none sm:w-60"
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
            >
              <option value="ALL">{t.expenses.selectors.allWarehouses}</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>{wh.name}</option>
              ))}
            </select>
          </div>

          {canClosePeriod && !isClosed && (
            <button
              type="button"
              onClick={() => setShowCloseConfirm(true)}
              className="col-span-2 h-9 w-full rounded-[var(--radius-sm)] bg-accent-error px-3 text-sm font-semibold text-text-on-dark transition-colors hover:bg-accent-error/90 sm:col-span-1 sm:w-fit"
            >
              {t.expenses.actions.closePeriod}
            </button>
          )}
        </div>
      </header>

      {showCloseConfirm && (
        <ClosePeriodConfirm
          onConfirm={handleClosePeriod}
          onCancel={() => setShowCloseConfirm(false)}
          t={t.expenses.actions}
        />
      )}

      <ExpenseDashboard warehouseId={warehouseId} period={period} />

      {warehouseId === "ALL" && !loading && (
        <div className="flex w-full items-center gap-3 rounded-[var(--radius-lg)] border border-accent-info/20 bg-accent-info/5 p-4">
          <Info size={16} className="shrink-0 text-accent-info" />
          <span className="text-xs text-text-secondary">
            {t.expenses.hint.selectWarehouse}
          </span>
        </div>
      )}

      {error && (
        <div className="w-full rounded-[var(--radius-lg)] border border-accent-error/20 bg-accent-error/10 p-4 text-sm text-accent-error">
          {error}
        </div>
      )}

      {loading && (
        <div className="w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]">
          <div className="flex gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
            <div className="h-3 w-24 skeleton-pulse rounded-radius-xs" />
            <div className="ml-auto h-3 w-16 skeleton-pulse rounded-radius-xs" />
            <div className="h-3 w-20 skeleton-pulse rounded-radius-xs" />
            <div className="h-3 w-12 skeleton-pulse rounded-radius-xs" />
          </div>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-2 border-b border-border-soft p-2">
              <div className="h-3 flex-1 skeleton-pulse rounded-radius-xs" />
              <div className="h-6 w-28 skeleton-pulse rounded-radius-xs" />
              <div className="h-6 w-32 skeleton-pulse rounded-radius-xs" />
              <div className="h-3 w-14 skeleton-pulse rounded-radius-xs" />
            </div>
          ))}
        </div>
      )}

      {!loading && data && (
        <div className="w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {t.expenses.title}
              </h3>
              <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                {period} · {selectedWarehouseName}
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
      )}
    </div>
  );
}
