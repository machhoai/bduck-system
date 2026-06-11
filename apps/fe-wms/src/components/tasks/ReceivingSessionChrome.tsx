"use client";

import {
  AlertTriangle,
  Clock,
  Package,
  ScanBarcode,
  Save,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

interface ReceivingSessionHeaderProps {
  voucherNumber: string;
  supplierName: string;
  onClose: () => void;
}

interface ReceivingSessionStatsBarProps {
  completedItems: number;
  totalItems: number;
  totalActual: number;
  totalExpected: number;
  itemsNeedingReview: number;
  lastSavedAt: Date | null;
}

interface ReceivingSessionFooterProps {
  isConfirmed: boolean;
  isSubmitting: boolean;
  completedItems: number;
  totalItems: number;
  onConfirmChange: (checked: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function ReceivingSessionHeader({
  voucherNumber,
  supplierName,
  onClose,
}: ReceivingSessionHeaderProps) {
  const { t } = useTranslation();

  return (
    <header className="flex items-center justify-between border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-neutral-100)]"
        >
          <X className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-base font-bold text-[var(--color-text-primary)]">
            {t.receiving.sessionTitle}
          </h2>
          {voucherNumber && (
            <p className="text-xs text-[var(--color-text-muted)]">
              {voucherNumber}
              {supplierName ? ` • ${supplierName}` : ""}
            </p>
          )}
        </div>
      </div>

      <div className="hidden items-center gap-1.5 rounded-full bg-[var(--color-status-approved-bg)] px-3 py-1.5 text-xs font-medium text-[var(--color-status-approved-text)] sm:flex">
        <ScanBarcode className="h-3.5 w-3.5" />
        {t.receiving.scannerReady}
      </div>
    </header>
  );
}

export function ReceivingSessionStatsBar({
  completedItems,
  totalItems,
  totalActual,
  totalExpected,
  itemsNeedingReview,
  lastSavedAt,
}: ReceivingSessionStatsBarProps) {
  const { t, lang } = useTranslation();
  const progressValue = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  const quantityValue =
    totalExpected > 0 ? Math.round((totalActual / totalExpected) * 100) : 0;

  return (
    <div className="border-b border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] px-4 py-3">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-brand-primary-muted)] px-3 py-1 text-xs font-medium text-[var(--color-brand-primary)]">
          <ScanBarcode className="h-3.5 w-3.5" />
          {t.receiving.progressLabel}: {progressValue}%
        </div>
        {lastSavedAt && (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-[var(--color-success-bg)] px-3 py-1 text-xs font-medium text-[var(--color-success-text)]">
            <Clock className="h-3 w-3" />
            {t.receiving.draftSavedAt}
            {lastSavedAt.toLocaleTimeString(lang === "zh" ? "zh-CN" : "vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </div>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Package className="h-3.5 w-3.5" />
            {t.receiving.productCount}
          </div>
          <div className="text-lg font-semibold text-[var(--color-text-primary)]">
            {completedItems}
            <span className="ml-1 text-sm font-medium text-[var(--color-text-muted)]">
              / {totalItems}
            </span>
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Clock className="h-3.5 w-3.5" />
            {t.receiving.quantityCount}
          </div>
          <div className="text-lg font-semibold text-[var(--color-text-primary)]">
            {totalActual}
            <span className="ml-1 text-sm font-medium text-[var(--color-text-muted)]">
              / {totalExpected}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
            <div
              className="h-full rounded-full bg-[var(--color-brand-primary)] transition-all"
              style={{ width: `${Math.min(quantityValue, 100)}%` }}
            />
          </div>
        </div>

        <div className="rounded-2xl border border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)]/50 p-3">
          <div className="mb-2 flex items-center gap-2 text-xs text-[var(--color-status-pending-text)]">
            <AlertTriangle className="h-3.5 w-3.5" />
            {t.receiving.needReview}
          </div>
          <div className="text-lg font-semibold text-[var(--color-text-primary)]">
            {itemsNeedingReview}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ReceivingSessionSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="animate-pulse rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-4"
        >
          <div className="flex gap-3">
            <div className="h-4 w-32 rounded bg-[var(--color-skeleton-base)]" />
            <div className="h-4 w-16 rounded bg-[var(--color-skeleton-base)]" />
          </div>
          <div className="mt-3 flex gap-3">
            <div className="h-8 flex-1 rounded-lg bg-[var(--color-skeleton-base)]" />
            <div className="h-8 flex-1 rounded-lg bg-[var(--color-skeleton-base)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReceivingSessionFooter({
  isConfirmed,
  isSubmitting,
  completedItems,
  totalItems,
  onConfirmChange,
  onClose,
  onSubmit,
}: ReceivingSessionFooterProps) {
  const { t } = useTranslation();

  return (
    <footer className="border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.04)]">
      <label
        className={`mb-3 flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 transition-all ${
          isConfirmed
            ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)]/40"
            : "border-[var(--color-border-soft)] bg-[var(--color-neutral-50)]"
        }`}
      >
        <input
          type="checkbox"
          checked={isConfirmed}
          onChange={(event) => onConfirmChange(event.target.checked)}
          className="mt-0.5 h-4 w-4 cursor-pointer rounded border-[var(--color-border-subtle)] accent-[var(--color-brand-primary)]"
        />
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <ShieldCheck
              className={`h-4 w-4 flex-shrink-0 ${
                isConfirmed
                  ? "text-[var(--color-success-icon)]"
                  : "text-[var(--color-text-muted)]"
              }`}
            />
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {t.receiving.confirmData}
            </span>
          </div>
          <p className="mt-0.5 text-xs leading-relaxed text-[var(--color-text-muted)]">
            {t.receiving.confirmStatement}
          </p>
        </div>
      </label>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-neutral-50)]"
        >
          <Save className="h-4 w-4" />
          {t.receiving.saveDraftAndClose}
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={isSubmitting || completedItems === 0 || !isConfirmed}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isConfirmed
              ? "bg-[var(--color-brand-primary)] text-[var(--color-text-on-dark)] hover:bg-[var(--color-brand-primary-dark)] active:opacity-90"
              : "cursor-not-allowed bg-[var(--color-neutral-200)] text-[var(--color-text-muted)]"
          }`}
        >
          {isSubmitting ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              <Send className="h-4 w-4" />
              {t.receiving.submitResults} ({completedItems}/{totalItems})
            </>
          )}
        </button>
      </div>
    </footer>
  );
}
