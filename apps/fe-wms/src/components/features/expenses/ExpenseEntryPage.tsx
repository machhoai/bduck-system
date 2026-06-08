"use client";

/**
 * ExpenseEntryPage — Full-page data entry for expenses
 *
 * Contains:
 * - Data table with 5 cost center groups
 * - Custom item add/remove per group
 * - Close/Reopen period actions (RBAC-gated)
 * - Skeleton loading states
 */

import { useCallback, useState } from "react";
import { ExpenseStatus } from "@bduck/shared-types";
import type { ExpenseCategory, ExpenseItem } from "@bduck/shared-types";
import { useExpenses } from "@/hooks/useExpenses";
import { useExpenseAuth } from "@/hooks/useExpenseAuth";
import { useTranslation } from "@/lib/i18n";
import { useWarehouses } from "@/hooks/useWarehouses";
import ExpenseDataEntry from "./ExpenseDataEntry";
import ExpenseExcelImportPanel from "./ExpenseExcelImportPanel";
import { gooeyToast } from "goey-toast";
import {
  AlertTriangle,
  Info,
  Lock,
  LockOpen,
  X,
} from "lucide-react";

// ─────────────────────────────────────────────
// Period Confirm Dialog
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
  const borderColor =
    variant === "danger" ? "border-accent-error/30" : "border-accent-warning/30";
  const bgColor =
    variant === "danger" ? "bg-accent-error/5" : "bg-accent-warning/5";
  const iconColor =
    variant === "danger" ? "text-accent-error" : "text-accent-warning";
  const btnBg =
    variant === "danger"
      ? "bg-accent-error hover:bg-accent-error/90"
      : "bg-accent-warning hover:bg-accent-warning/90";

  return (
    <div
      className={`flex w-full flex-wrap items-center gap-3 rounded-radius-lg border ${borderColor} ${bgColor} p-4`}
    >
      <AlertTriangle size={16} className={`shrink-0 ${iconColor}`} />
      <span className="min-w-56 flex-1 text-xs text-text-secondary">
        {message}
      </span>
      <button
        type="button"
        onClick={onCancel}
        className="flex h-8 w-8 items-center justify-center rounded-radius-sm border border-border-subtle text-text-muted transition-colors hover:bg-surface-card"
        aria-label="Close"
      >
        <X size={13} />
      </button>
      <button
        type="button"
        onClick={onConfirm}
        className={`h-8 w-fit rounded-radius-sm ${btnBg} px-3 text-xs font-semibold text-text-on-dark transition-colors`}
      >
        {actionLabel}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────

function EntryPageSkeleton() {
  return (
    <div className="w-full overflow-hidden rounded-radius-lg border border-border-soft bg-surface-elevated">
      <div className="flex gap-2 border-b border-border-subtle bg-surface-card p-3">
        <div className="h-3 w-24 animate-pulse rounded-radius-xs bg-surface-base" />
        <div className="ml-auto h-3 w-16 animate-pulse rounded-radius-xs bg-surface-base" />
        <div className="h-3 w-20 animate-pulse rounded-radius-xs bg-surface-base" />
        <div className="h-3 w-12 animate-pulse rounded-radius-xs bg-surface-base" />
      </div>
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 border-b border-border-soft p-2"
        >
          <div className="h-3 flex-1 animate-pulse rounded-radius-xs bg-surface-base" />
          <div className="h-6 w-28 animate-pulse rounded-radius-xs bg-surface-base" />
          <div className="h-6 w-32 animate-pulse rounded-radius-xs bg-surface-base" />
          <div className="h-3 w-14 animate-pulse rounded-radius-xs bg-surface-base" />
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

interface ExpenseEntryPageProps {
  warehouseId: string;
  period: string;
}

export default function ExpenseEntryPage({
  warehouseId,
  period,
}: ExpenseEntryPageProps) {
  const { t } = useTranslation();
  const [confirmAction, setConfirmAction] = useState<
    "close" | "reopen" | null
  >(null);

  const { warehouses } = useWarehouses();

  const {
    data,
    loading,
    error,
    updateItem,
    saveCustomItem,
    deleteCustomItem,
    refresh,
    closePeriod,
    reopenPeriod,
  } = useExpenses(warehouseId, period);

  const { canClosePeriod, canReopenPeriod } = useExpenseAuth(warehouseId);

  const isClosed =
    warehouseId !== "ALL" && data?.status === ExpenseStatus.CLOSED;

  const selectedWarehouseName =
    warehouseId === "ALL"
      ? t.expenses.selectors.allWarehouses
      : warehouses.find((wh) => wh.id === warehouseId)?.name ?? warehouseId;

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
      console.error("[ExpenseEntryPage] close period error:", err);
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
      console.error("[ExpenseEntryPage] reopen period error:", err);
    }
  }, [reopenPeriod, t]);

  const handleSaveItem = useCallback(
    async (category: ExpenseCategory, itemData: Partial<ExpenseItem>) => {
      await updateItem(category, itemData as Record<string, unknown>);
    },
    [updateItem],
  );

  // ─── Consolidated View ───

  if (warehouseId === "ALL") {
    return (
      <div className="flex w-full items-center gap-3 rounded-radius-lg border border-accent-info/20 bg-accent-info/5 p-4">
        <Info size={16} className="shrink-0 text-accent-info" />
        <span className="text-xs text-text-secondary">
          {t.expenses.hint.selectWarehouse}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── Status + Period Actions ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Status badge */}
        {data && (
          <span
            className={`inline-flex h-6 items-center gap-1 rounded-radius-pill px-2 text-xxs font-semibold uppercase tracking-wider ${
              isClosed
                ? "bg-accent-error/10 text-accent-error"
                : "bg-accent-success/10 text-accent-success"
            }`}
          >
            {isClosed && <Lock size={10} />}
            {isClosed
              ? t.expenses.status.CLOSED
              : t.expenses.status.OPEN}
          </span>
        )}

        <span className="text-xs text-text-muted">
          {period} · {selectedWarehouseName}
        </span>

        <div className="ml-auto flex items-center gap-2">
          {/* Close Period */}
          {canClosePeriod && !isClosed && (
            <button
              type="button"
              onClick={() => setConfirmAction("close")}
              className="flex h-8 w-fit items-center gap-1.5 rounded-radius-sm bg-accent-error px-3 text-xs font-semibold text-text-on-dark transition-colors hover:bg-accent-error/90"
            >
              <Lock size={13} />
              {t.expenses.actions.closePeriod}
            </button>
          )}

          {/* Reopen Period */}
          {canReopenPeriod && isClosed && (
            <button
              type="button"
              onClick={() => setConfirmAction("reopen")}
              className="flex h-8 w-fit items-center gap-1.5 rounded-radius-sm border border-accent-warning bg-accent-warning/10 px-3 text-xs font-semibold text-accent-warning transition-colors hover:bg-accent-warning/20"
            >
              <LockOpen size={13} />
              {t.expenses.actions.reopenPeriod}
            </button>
          )}
        </div>
      </div>

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

      {/* ── Error ── */}
      {error && (
        <div className="w-full rounded-radius-lg border border-accent-error/20 bg-accent-error/10 p-4 text-sm text-accent-error">
          {error}
        </div>
      )}

      {/* ── Loading Skeleton ── */}
      {loading && <EntryPageSkeleton />}

      {!loading && data && (
        <ExpenseExcelImportPanel
          data={data}
          isClosed={isClosed}
          onSaveItem={handleSaveItem}
          onSaveCustomItem={saveCustomItem}
          onImported={refresh}
        />
      )}

      {/* ── Data Entry Table ── */}
      {!loading && data && (
        <ExpenseDataEntry
          warehouseId={warehouseId}
          period={period}
          isClosed={isClosed}
          data={data}
          onSaveItem={handleSaveItem}
          onSaveCustomItem={saveCustomItem}
          onDeleteCustomItem={deleteCustomItem}
          warehouseName={selectedWarehouseName}
        />
      )}
    </div>
  );
}
