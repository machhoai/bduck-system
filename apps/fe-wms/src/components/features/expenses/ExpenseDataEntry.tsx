"use client";

/**
 * ExpenseDataEntry — Bảng nhập liệu chi phí theo kỳ kế toán
 *
 * 5 nhóm: OPERATIONS, HR, MARKETING, MERCHANDISE, OTHERS
 * Hỗ trợ custom items (user tự tạo) trong mỗi nhóm.
 */

import { useMemo, useCallback, useState } from "react";
import {
  ExpenseCategory,
  ExpenseCostCenter,
} from "@bduck/shared-types";
import type { ExpenseItem, ExpenseCustomItem } from "@bduck/shared-types";
import { useExpenseAuth, useExpenseAuthByCostCenter } from "@/hooks/useExpenseAuth";
import { useTranslation } from "@/lib/i18n";
import {
  EXPENSE_CATEGORY_CONFIGS,
  EXPENSE_COST_CENTER_ORDER,
  type ExpenseCategoryConfig,
} from "@/utils/expenseConfig";
import StandardExpenseCell from "./StandardExpenseCell";
import SemiAutoExpenseCell from "./SemiAutoExpenseCell";
import { gooeyToast } from "goey-toast";
import { Info, Plus, Trash2 } from "lucide-react";

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
// Standard Expense Row
// ─────────────────────────────────────────────

function ExpenseRow({
  config, item, warehouseId, isClosed, onSave, label,
}: {
  config: ExpenseCategoryConfig;
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
    <tr className="group border-b border-border-soft transition-colors hover:bg-surface-card">
      <td className="sticky left-0 z-10 bg-surface-elevated p-2 text-sm font-medium text-text-primary transition-colors group-hover:bg-surface-card">
        <div className="flex min-w-44 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-radius-pill ${getVarianceDotClass(variance)}`} />
          <span className="truncate">{label}</span>
        </div>
      </td>
      <td className="p-1.5 align-middle">
        <StandardExpenseCell value={budgetAmount} canWrite={effectiveCanWrite} onSave={handleBudgetSave} />
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
          <StandardExpenseCell value={actualAmount} canWrite={effectiveCanWrite} onSave={handleActualSave} />
        )}
      </td>
      <td className="p-1.5 text-right align-middle">
        {budgetAmount > 0 ? (
          <div className="ml-auto flex min-w-24 flex-col items-end gap-1">
            <span className={`inline-flex h-6 min-w-16 items-center justify-center rounded-radius-pill border px-2 text-xxs font-bold tabular-nums ${getVarianceClass(variance)}`}>
              {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
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
// Custom Item Row
// ─────────────────────────────────────────────

function CustomItemRow({
  item, warehouseId, isClosed, onSave, onDelete,
}: {
  item: ExpenseCustomItem;
  warehouseId: string;
  isClosed: boolean;
  onSave: (itemId: string, data: { label: string; cost_center: string; actual_amount: number; budget_amount: number | null; }) => Promise<void>;
  onDelete: (itemId: string) => Promise<void>;
}) {
  const { t } = useTranslation();
  const { canWrite } = useExpenseAuthByCostCenter(warehouseId, item.cost_center);
  const effectiveCanWrite = canWrite && !isClosed;
  const [deleting, setDeleting] = useState(false);

  const actualAmount = item.actual_amount ?? 0;
  const budgetAmount = item.budget_amount ?? 0;
  const variance = budgetAmount > 0
    ? ((actualAmount - budgetAmount) / budgetAmount) * 100
    : 0;

  const handleActualSave = useCallback(
    (value: number) => {
      onSave(item.id, {
        label: item.label,
        cost_center: item.cost_center,
        actual_amount: value,
        budget_amount: item.budget_amount,
      });
    },
    [item, onSave],
  );

  const handleBudgetSave = useCallback(
    (value: number) => {
      onSave(item.id, {
        label: item.label,
        cost_center: item.cost_center,
        actual_amount: item.actual_amount,
        budget_amount: value,
      });
    },
    [item, onSave],
  );

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      await gooeyToast.promise(onDelete(item.id), {
        loading: t.expenses.actions.deleting,
        success: t.expenses.actions.deleted,
        error: t.expenses.actions.deleteFailed,
      });
    } catch (err) {
      console.error("[CustomItemRow] delete error:", err);
    } finally {
      setDeleting(false);
    }
  }, [item.id, onDelete, t]);

  return (
    <tr className="group border-b border-border-soft transition-colors hover:bg-surface-card">
      <td className="sticky left-0 z-10 bg-surface-elevated p-2 text-sm font-medium text-text-primary transition-colors group-hover:bg-surface-card">
        <div className="flex min-w-44 items-center gap-2">
          <span className={`h-2 w-2 shrink-0 rounded-radius-pill ${getVarianceDotClass(variance)}`} />
          <span className="truncate text-brand-primary">{item.label}</span>
          {effectiveCanWrite && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="ml-auto shrink-0 rounded-radius-xs p-0.5 text-text-muted opacity-0 transition-all hover:bg-accent-error/10 hover:text-accent-error group-hover:opacity-100 disabled:opacity-50"
              aria-label={t.expenses.actions.removeCustomItem}
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </td>
      <td className="p-1.5 align-middle">
        <StandardExpenseCell value={budgetAmount} canWrite={effectiveCanWrite} onSave={handleBudgetSave} />
      </td>
      <td className="p-1.5 align-middle">
        <StandardExpenseCell value={actualAmount} canWrite={effectiveCanWrite} onSave={handleActualSave} />
      </td>
      <td className="p-1.5 text-right align-middle">
        {budgetAmount > 0 ? (
          <span className={`inline-flex h-6 min-w-16 items-center justify-center rounded-radius-pill border px-2 text-xxs font-bold tabular-nums ${getVarianceClass(variance)}`}>
            {variance > 0 ? "+" : ""}{variance.toFixed(1)}%
          </span>
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
    custom_items?: Record<string, ExpenseCustomItem>;
  };
  onSaveItem: (category: ExpenseCategory, itemData: Partial<ExpenseItem>) => Promise<void>;
  onSaveCustomItem: (itemId: string, data: { label: string; cost_center: string; actual_amount: number; budget_amount: number | null; }) => Promise<void>;
  onDeleteCustomItem: (itemId: string) => Promise<void>;
  warehouseName: string;
}

export default function ExpenseDataEntry({
  warehouseId,
  period,
  isClosed,
  data,
  onSaveItem,
  onSaveCustomItem,
  onDeleteCustomItem,
  warehouseName,
}: ExpenseDataEntryProps) {
  const { t } = useTranslation();
  const [newItemLabels, setNewItemLabels] = useState<Record<string, string>>({});

  const grouped = useMemo(() => {
    const map = new Map<ExpenseCostCenter, ExpenseCategoryConfig[]>();
    for (const config of EXPENSE_CATEGORY_CONFIGS) {
      const list = map.get(config.costCenter) || [];
      list.push(config);
      map.set(config.costCenter, list);
    }
    return map;
  }, []);

  // Filter custom items by cost center
  const customItemsByCostCenter = useMemo(() => {
    const map = new Map<ExpenseCostCenter, ExpenseCustomItem[]>();
    if (!data.custom_items) return map;
    for (const item of Object.values(data.custom_items)) {
      if (item.is_deleted) continue;
      const list = map.get(item.cost_center) || [];
      list.push(item);
      map.set(item.cost_center, list);
    }
    return map;
  }, [data.custom_items]);

  const handleSaveItem = useCallback(
    async (category: ExpenseCategory, itemData: Partial<ExpenseItem>) => {
      try {
        await gooeyToast.promise(onSaveItem(category, itemData), {
          loading: t.expenses.actions.saving,
          success: t.expenses.actions.saved,
          error: t.expenses.actions.saveFailed,
        });
      } catch (err) {
        console.error("[ExpenseDataEntry] save error:", err);
      }
    },
    [onSaveItem, t],
  );

  const handleAddCustomItem = useCallback(
    async (costCenter: ExpenseCostCenter) => {
      const label = newItemLabels[costCenter]?.trim();
      if (!label) return;
      const itemId = crypto.randomUUID();
      try {
        await gooeyToast.promise(
          onSaveCustomItem(itemId, {
            label,
            cost_center: costCenter,
            actual_amount: 0,
            budget_amount: null,
          }),
          {
            loading: t.expenses.actions.saving,
            success: t.expenses.actions.saved,
            error: t.expenses.actions.saveFailed,
          },
        );
        setNewItemLabels((prev) => ({ ...prev, [costCenter]: "" }));
      } catch (err) {
        console.error("[ExpenseDataEntry] add custom item error:", err);
      }
    },
    [newItemLabels, onSaveCustomItem, t],
  );

  // Totals
  const totalActual = useMemo(() => {
    let sum = Object.values(data.items).reduce((s, item) => s + (item?.actual_amount ?? 0), 0);
    if (data.custom_items) {
      sum += Object.values(data.custom_items)
        .filter((i) => !i.is_deleted)
        .reduce((s, item) => s + (item.actual_amount ?? 0), 0);
    }
    return sum;
  }, [data.items, data.custom_items]);

  const totalBudget = useMemo(() => {
    let sum = Object.values(data.items).reduce((s, item) => s + (item?.budget_amount ?? 0), 0);
    if (data.custom_items) {
      sum += Object.values(data.custom_items)
        .filter((i) => !i.is_deleted)
        .reduce((s, item) => s + (item.budget_amount ?? 0), 0);
    }
    return sum;
  }, [data.items, data.custom_items]);

  const totalVariance = totalBudget > 0
    ? ((totalActual - totalBudget) / totalBudget) * 100
    : 0;

  // Consolidated mode
  if (warehouseId === "ALL") {
    return (
      <div className="flex w-full items-center gap-3 rounded-radius-lg border border-accent-info/20 bg-accent-info/5 p-4">
        <Info size={16} className="shrink-0 text-accent-info" />
        <span className="text-xs text-text-secondary">{t.expenses.hint.selectWarehouse}</span>
      </div>
    );
  }

  return (
    <div className="w-full overflow-hidden rounded-radius-lg border border-border-soft bg-surface-elevated">
      <div className="w-full overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-card">
              <th className="sticky left-0 z-20 bg-surface-card p-2 text-left text-xxs font-semibold uppercase tracking-wider text-text-muted">
                {t.expenses.columns.category}
              </th>
              <th className="w-44 p-2 text-left text-xxs font-semibold uppercase tracking-wider text-text-muted">
                {t.expenses.columns.budget}
              </th>
              <th className="w-56 p-2 text-left text-xxs font-semibold uppercase tracking-wider text-text-muted">
                {t.expenses.columns.actual}
              </th>
              <th className="w-32 p-2 text-right text-xxs font-semibold uppercase tracking-wider text-text-muted">
                {t.expenses.columns.variance}
              </th>
            </tr>
          </thead>
          <tbody>
            {EXPENSE_COST_CENTER_ORDER.map((costCenter) => {
              const configs = grouped.get(costCenter) || [];
              const customItems = customItemsByCostCenter.get(costCenter) || [];
              const centerLabel = t.expenses.costCenter[costCenter] || costCenter;

              // Group totals
              const centerBudget = configs.reduce(
                (sum, config) => sum + (data.items[config.key]?.budget_amount ?? 0), 0,
              ) + customItems.reduce((sum, i) => sum + (i.budget_amount ?? 0), 0);
              const centerActual = configs.reduce(
                (sum, config) => sum + (data.items[config.key]?.actual_amount ?? 0), 0,
              ) + customItems.reduce((sum, i) => sum + (i.actual_amount ?? 0), 0);
              const centerVariance = centerBudget > 0
                ? ((centerActual - centerBudget) / centerBudget) * 100
                : 0;

              return [
                /* Group header */
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

                /* Standard rows */
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

                /* Custom items */
                ...customItems.map((item) => (
                  <CustomItemRow
                    key={item.id}
                    item={item}
                    warehouseId={warehouseId}
                    isClosed={isClosed}
                    onSave={onSaveCustomItem}
                    onDelete={onDeleteCustomItem}
                  />
                )),

                /* Add custom item row */
                !isClosed && (
                  <AddCustomItemRow
                    key={`add-${costCenter}`}
                    costCenter={costCenter}
                    warehouseId={warehouseId}
                    label={newItemLabels[costCenter] || ""}
                    onLabelChange={(v) =>
                      setNewItemLabels((prev) => ({ ...prev, [costCenter]: v }))
                    }
                    onAdd={() => handleAddCustomItem(costCenter)}
                    placeholder={t.expenses.actions.customItemPlaceholder}
                    addLabel={t.expenses.actions.addCustomItem}
                  />
                ),
              ];
            })}

            {/* Total row */}
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
                    {totalVariance > 0 ? "+" : ""}{totalVariance.toFixed(1)}%
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

// ─────────────────────────────────────────────
// Add Custom Item Row
// ─────────────────────────────────────────────

function AddCustomItemRow({
  costCenter, warehouseId, label, onLabelChange, onAdd, placeholder, addLabel,
}: {
  costCenter: ExpenseCostCenter;
  warehouseId: string;
  label: string;
  onLabelChange: (v: string) => void;
  onAdd: () => void;
  placeholder: string;
  addLabel: string;
}) {
  const { canWrite } = useExpenseAuthByCostCenter(warehouseId, costCenter);
  if (!canWrite) return null;

  return (
    <tr className="border-b border-border-soft">
      <td colSpan={4} className="p-1.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="h-7 flex-1 rounded-radius-xs border border-dashed border-border-subtle bg-transparent px-2 text-xs text-text-secondary placeholder:text-text-muted focus:border-brand-primary focus:outline-none"
            placeholder={placeholder}
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
          />
          <button
            type="button"
            onClick={onAdd}
            disabled={!label.trim()}
            className="flex h-7 w-fit items-center gap-1 rounded-radius-xs bg-brand-primary/10 px-2 text-xxs font-medium text-brand-primary transition-colors hover:bg-brand-primary/20 disabled:opacity-40"
          >
            <Plus size={12} />
            {addLabel}
          </button>
        </div>
      </td>
    </tr>
  );
}
