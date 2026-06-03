"use client";

/**
 * ExpenseWorkspace — Shell component with tab navigation
 *
 * 2 tabs:
 * - Dashboard (KPI cards, charts, alerts)
 * - Nhập liệu (data entry table)
 *
 * Handles: warehouse/period selectors, period close/reopen, RBAC
 */

import { useState, useCallback, useEffect } from "react";
import { ExpenseStatus } from "@bduck/shared-types";
import type { ExpenseCategory, ExpenseItem } from "@bduck/shared-types";
import { useExpenses } from "@/hooks/useExpenses";
import { useExpenseAuth } from "@/hooks/useExpenseAuth";
import { useTranslation } from "@/lib/i18n";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useUserStore } from "@/stores/useUserStore";
import ExpenseDashboard from "./ExpenseDashboard";
import ExpenseDataEntry from "./ExpenseDataEntry";
import { gooeyToast } from "goey-toast";
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  Lock,
  LockOpen,
  PenLine,
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

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────
// Period Confirm Dialog (used for both close & reopen)
// ─────────────────────────────────────────────

function PeriodActionConfirm({
  message,
  actionLabel,
  variant,
  onConfirm,
  onCancel,
}: {
  message: string;
  actionLabel: string;
  variant: "danger" | "warning";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const borderColor = variant === "danger" ? "border-accent-error/30" : "border-accent-warning/30";
  const bgColor = variant === "danger" ? "bg-accent-error/5" : "bg-accent-warning/5";
  const iconColor = variant === "danger" ? "text-accent-error" : "text-accent-warning";
  const btnBg = variant === "danger"
    ? "bg-accent-error hover:bg-accent-error/90"
    : "bg-accent-warning hover:bg-accent-warning/90";

  return (
    <div className={`flex w-full flex-wrap items-center gap-3 rounded-[var(--radius-lg)] border ${borderColor} ${bgColor} p-4`}>
      <AlertTriangle size={16} className={`shrink-0 ${iconColor}`} />
      <span className="min-w-56 flex-1 text-xs text-text-secondary">
        {message}
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
        className={`h-8 w-fit rounded-[var(--radius-sm)] ${btnBg} px-3 text-xs font-semibold text-text-on-dark transition-colors`}
      >
        {actionLabel}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab type
// ─────────────────────────────────────────────

type ExpenseTab = "dashboard" | "entry";

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function ExpenseWorkspace() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState(getCurrentPeriod);
  const [warehouseId, setWarehouseId] = useState("ALL");
  const [activeTab, setActiveTab] = useState<ExpenseTab>("dashboard");
  const [confirmAction, setConfirmAction] = useState<"close" | "reopen" | null>(null);
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

  const { data, loading, error, updateItem, closePeriod, reopenPeriod } = useExpenses(
    warehouseId,
    period,
  );
  const { canClosePeriod, canReopenPeriod } = useExpenseAuth(warehouseId);

  // Fix: Only consider period closed for a SPECIFIC warehouse, never for ALL
  const isClosed = warehouseId !== "ALL" && data?.status === ExpenseStatus.CLOSED;

  const selectedWarehouseName = warehouseId === "ALL"
    ? t.expenses.selectors.allWarehouses
    : warehouses.find((warehouse) => warehouse.id === warehouseId)?.name ?? warehouseId;

  // ─── Period Actions ───

  const handleClosePeriod = useCallback(async () => {
    setConfirmAction(null);
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

  const handleReopenPeriod = useCallback(async () => {
    setConfirmAction(null);
    try {
      await gooeyToast.promise(reopenPeriod(), {
        loading: t.expenses.actions.reopening,
        success: t.expenses.actions.reopened,
        error: t.expenses.actions.reopenFailed,
      });
    } catch (err) {
      console.error("[ExpenseWorkspace] reopen period error:", err);
    }
  }, [reopenPeriod, t]);

  const handleSaveItem = useCallback(
    async (category: ExpenseCategory, itemData: Partial<ExpenseItem>) => {
      await updateItem(category, itemData as Record<string, unknown>);
    },
    [updateItem],
  );

  // ─── Tab Config ───

  const tabs = [
    {
      key: "dashboard" as ExpenseTab,
      label: t.nav.expenseDashboard,
      icon: BarChart3,
    },
    {
      key: "entry" as ExpenseTab,
      label: t.nav.expenseEntry,
      icon: PenLine,
    },
  ];

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
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

          {/* Close Period button */}
          {canClosePeriod && !isClosed && warehouseId !== "ALL" && (
            <button
              type="button"
              onClick={() => setConfirmAction("close")}
              className="col-span-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-accent-error px-3 text-sm font-semibold text-text-on-dark transition-colors hover:bg-accent-error/90 sm:col-span-1 sm:w-fit"
            >
              <Lock size={13} />
              {t.expenses.actions.closePeriod}
            </button>
          )}

          {/* Reopen Period button */}
          {canReopenPeriod && isClosed && (
            <button
              type="button"
              onClick={() => setConfirmAction("reopen")}
              className="col-span-2 flex h-9 w-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] border border-accent-warning bg-accent-warning/10 px-3 text-sm font-semibold text-accent-warning transition-colors hover:bg-accent-warning/20 sm:col-span-1 sm:w-fit"
            >
              <LockOpen size={13} />
              {t.expenses.actions.reopenPeriod}
            </button>
          )}
        </div>
      </header>

      {/* ── Confirm Dialog ── */}
      {confirmAction === "close" && (
        <PeriodActionConfirm
          message={t.expenses.actions.closePeriodConfirm}
          actionLabel={t.expenses.actions.closePeriod}
          variant="danger"
          onConfirm={handleClosePeriod}
          onCancel={() => setConfirmAction(null)}
        />
      )}
      {confirmAction === "reopen" && (
        <PeriodActionConfirm
          message={t.expenses.actions.reopenPeriodConfirm}
          actionLabel={t.expenses.actions.reopenPeriod}
          variant="warning"
          onConfirm={handleReopenPeriod}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-1">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.key;
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex h-8 flex-1 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] text-sm font-medium transition-all duration-200 sm:flex-none sm:px-4 ${
                isActive
                  ? "bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              <TabIcon size={14} strokeWidth={isActive ? 2 : 1.5} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="w-full rounded-[var(--radius-lg)] border border-accent-error/20 bg-accent-error/10 p-4 text-sm text-accent-error">
          {error}
        </div>
      )}

      {/* ── Loading ── */}
      {loading && (
        <div className="w-full overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]">
          {activeTab === "dashboard" ? (
            <div className="flex w-full flex-col gap-4 p-4">
              <div className="grid w-full grid-cols-2 gap-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-[100px] animate-pulse rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]" />
                ))}
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
        </div>
      )}

      {/* ── Tab Content ── */}
      {!loading && data && (
        <>
          {activeTab === "dashboard" && (
            <ExpenseDashboard warehouseId={warehouseId} period={period} />
          )}

          {activeTab === "entry" && (
            <ExpenseDataEntry
              warehouseId={warehouseId}
              period={period}
              isClosed={isClosed}
              data={data}
              onSaveItem={handleSaveItem}
              warehouseName={selectedWarehouseName}
            />
          )}
        </>
      )}
    </div>
  );
}
