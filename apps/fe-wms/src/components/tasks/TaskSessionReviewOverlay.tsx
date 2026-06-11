"use client";

import { AlertTriangle, ArrowLeft, CheckCircle2, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import TaskProductThumb from "./TaskProductThumb";

interface ReviewItem {
  id: string;
  product_name: string;
  product_sku: string;
  product_barcode?: string;
  product_image_url: string | null;
  location_name: string;
  expected_quantity: number;
  actual_quantity: number;
}

interface TaskSessionReviewOverlayProps {
  title: string;
  description: string;
  quantityLabel: string;
  expectedLabel: string;
  actualLabel: string;
  diffLabel: string;
  confirmLabel: string;
  attentionLabel: string;
  items: ReviewItem[];
  isSubmitting: boolean;
  onBack: () => void;
  onClose: () => void;
  onConfirm: () => void;
}

function getDiffTone(diff: number) {
  if (diff === 0) {
    return "bg-[var(--color-success-bg-muted)] text-[var(--color-success-text-strong)]";
  }

  if (diff > 0) {
    return "bg-[var(--color-status-approved-bg-muted)] text-[var(--color-status-approved-text)]";
  }

  return "bg-[var(--color-error-bg-muted)] text-[var(--color-error-text)]";
}

export default function TaskSessionReviewOverlay({
  title,
  description,
  quantityLabel,
  expectedLabel,
  actualLabel,
  diffLabel,
  confirmLabel,
  attentionLabel,
  items,
  isSubmitting,
  onBack,
  onClose,
  onConfirm,
}: TaskSessionReviewOverlayProps) {
  const { t } = useTranslation();
  const attentionItems = items.filter(
    (item) => item.actual_quantity === 0 || item.actual_quantity !== item.expected_quantity,
  ).length;
  const totalExpected = items.reduce((sum, item) => sum + item.expected_quantity, 0);
  const totalActual = items.reduce((sum, item) => sum + item.actual_quantity, 0);

  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-[var(--color-bg-base)]">
      <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] bg-white px-4 py-3 shadow-sm">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-border-subtle)] text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {title}
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">{description}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="border-b border-[var(--color-border-soft)] bg-white px-4 py-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
            <div className="mb-1 text-xs text-[var(--color-text-muted)]">{quantityLabel}</div>
            <div className="text-lg font-semibold text-[var(--color-text-primary)]">
              {totalActual}
              <span className="ml-1 text-sm font-medium text-[var(--color-text-muted)]">
                / {totalExpected}
              </span>
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
            <div className="mb-1 text-xs text-[var(--color-text-muted)]">{t.receiving.productCount}</div>
            <div className="text-lg font-semibold text-[var(--color-text-primary)]">
              {items.length}
            </div>
          </div>
          <div className="rounded-2xl border border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)]/40 p-3">
            <div className="mb-1 text-xs text-[var(--color-status-pending-text)]">
              {attentionLabel}
            </div>
            <div className="text-lg font-semibold text-[var(--color-text-primary)]">
              {attentionItems}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="space-y-2">
          {items.map((item) => {
            const diff = item.actual_quantity - item.expected_quantity;
            const isMatched = diff === 0 && item.actual_quantity > 0;

            return (
              <div
                key={item.id}
                className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-3 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <TaskProductThumb
                    imageUrl={item.product_image_url}
                    name={item.product_name}
                    sku={item.product_sku}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text-primary)]">
                          {item.product_name}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-[var(--color-text-secondary)]">
                          <span className="rounded-full bg-[var(--color-surface-card)] px-2.5 py-1">
                            {item.product_sku || t.common.noData}
                          </span>
                          {item.product_barcode ? (
                            <span className="rounded-full bg-[var(--color-brand-primary-muted)] px-2.5 py-1 text-[var(--color-brand-primary)]">
                              {item.product_barcode}
                            </span>
                          ) : null}
                          <span className="rounded-full bg-[var(--color-surface-card)] px-2.5 py-1">
                            {item.location_name || t.common.noData}
                          </span>
                        </div>
                      </div>

                      <div
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                          isMatched
                            ? "bg-[var(--color-success-bg)] text-[var(--color-success-text-strong)]"
                            : "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]"
                        }`}
                      >
                        {isMatched ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                        {isMatched ? t.receiving.matched : attentionLabel}
                      </div>
                    </div>

                    <div className="mt-3 grid grid-cols-3 gap-2">
                      <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-2.5">
                        <div className="text-[11px] text-[var(--color-text-muted)]">
                          {expectedLabel}
                        </div>
                        <div className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
                          {item.expected_quantity}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-2.5">
                        <div className="text-[11px] text-[var(--color-text-muted)]">
                          {actualLabel}
                        </div>
                        <div className="mt-1 text-base font-semibold text-[var(--color-text-primary)]">
                          {item.actual_quantity}
                        </div>
                      </div>
                      <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-2.5">
                        <div className="text-[11px] text-[var(--color-text-muted)]">
                          {diffLabel}
                        </div>
                        <div
                          className={`mt-1 inline-flex rounded-lg px-2 py-1 text-base font-bold ${getDiffTone(diff)}`}
                        >
                          {diff > 0 ? `+${diff}` : diff}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--color-border-soft)] bg-white px-4 py-3 shadow-inner">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onBack}
            disabled={isSubmitting}
            className="flex flex-1 items-center justify-center rounded-xl border border-[var(--color-border-subtle)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)] disabled:opacity-50"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="flex flex-1 items-center justify-center rounded-xl bg-[var(--color-brand-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--color-text-on-dark)] transition-colors hover:bg-[var(--color-brand-primary-dark)] disabled:opacity-50"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
