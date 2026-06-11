"use client";

/**
 * ReceivingItemRow — Single item row in the Receiving Session
 *
 * Features:
 * - Inline actual_quantity input (number)
 * - Visual comparison with expected_quantity
 * - Discrepancy highlight (red/green)
 * - Notes field (expandable)
 */

import { useState, useCallback } from "react";
import {
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  MapPin,
  ScanBarcode,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { ReceivingItem } from "@/stores/useReceivingStore";
import TaskProductThumb from "./TaskProductThumb";

interface ReceivingItemRowProps {
  item: ReceivingItem;
  isHighlighted: boolean;
  onQuantityChange: (id: string, qty: number) => void;
  onNotesChange: (id: string, notes: string) => void;
}

export default function ReceivingItemRow({
  item,
  isHighlighted,
  onQuantityChange,
  onNotesChange,
}: ReceivingItemRowProps) {
  const [showNotes, setShowNotes] = useState(!!item.notes);
  const { t } = useTranslation();
  const productName = item.product_name || t.common.noData;
  const productSku = item.product_sku || t.common.noData;
  const locationName = item.location_name || t.common.noData;
  const barcode = item.product_barcode || "";

  const discrepancy = item.actual_quantity - item.expected_quantity;
  const hasDiscrepancy = discrepancy !== 0 && item.actual_quantity > 0;
  const isComplete = item.actual_quantity === item.expected_quantity && item.actual_quantity > 0;
  const hasStarted = item.actual_quantity > 0;
  const progress =
    item.expected_quantity > 0
      ? Math.min(Math.round((item.actual_quantity / item.expected_quantity) * 100), 100)
      : 0;

  const statusMeta = isComplete
    ? {
        label: t.receiving.matched,
        tone:
          "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text-strong)]",
        icon: <CheckCircle className="h-4 w-4" />,
      }
    : hasDiscrepancy
      ? {
          label: discrepancy > 0 ? t.receiving.excess : t.receiving.shortage,
          tone:
            "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
          icon: <AlertTriangle className="h-4 w-4" />,
        }
      : {
          label: t.receiving.needReview,
          tone:
            "border-[var(--color-border-soft)] bg-[var(--color-surface-card)] text-[var(--color-text-secondary)]",
          icon: <ChevronDown className="h-4 w-4" />,
        };

  const handleQuantityChange = useCallback(
    (value: string) => {
      const parsedValue = Number(value);
      onQuantityChange(
        item.id,
        Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0,
      );
    },
    [item.id, onQuantityChange],
  );

  return (
    <div
      className={`rounded-2xl border p-4 transition-all duration-300
        ${isHighlighted ? "border-[var(--color-status-approved-icon)] bg-[var(--color-status-approved-bg)]/60 ring-2 ring-[var(--color-status-approved-border)]" : ""}
        ${hasDiscrepancy ? "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)]/40" : ""}
        ${isComplete ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)]/20" : ""}
        ${!isHighlighted && !hasDiscrepancy && !isComplete ? "border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] shadow-sm" : ""}
      `}
    >
      <div className="flex items-start gap-3">
        <TaskProductThumb
          imageUrl={item.product_image_url}
          name={productName}
          sku={productSku}
        />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text-primary)]">
                {productName}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="inline-flex items-center rounded-full bg-[var(--color-surface-card)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-text-secondary)]">
                  {t.tasks.detail.sku}: {productSku}
                </span>
                {barcode && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--color-brand-primary-muted)] px-2.5 py-1 text-[11px] font-medium text-[var(--color-brand-primary)]">
                    <ScanBarcode className="h-3 w-3" />
                    {barcode}
                  </span>
                )}
              </div>
            </div>

            <div
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusMeta.tone}`}
            >
              {statusMeta.icon}
              {statusMeta.label}
            </div>
          </div>

          <div className="mt-2 inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--color-surface-card)] px-2.5 py-1 text-[11px] text-[var(--color-text-secondary)]">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{locationName}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_88px]">
        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
          <label className="text-[11px] font-medium text-[var(--color-text-muted)]">
            {t.receiving.expected}
          </label>
          <div className="mt-1 text-xl font-semibold text-[var(--color-text-primary)]">
            {item.expected_quantity}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
          <label className="text-[11px] font-medium text-[var(--color-text-muted)]">
            {t.receiving.actual}
          </label>
          <input
            type="number"
            min={0}
            value={item.actual_quantity}
            onChange={(event) => handleQuantityChange(event.target.value)}
            className={`mt-0.5 w-full rounded-lg border px-3 py-2 text-sm font-semibold text-center outline-none
              transition-colors focus:ring-2
              ${
                hasDiscrepancy
                  ? "border-[var(--color-status-pending-border)] text-[var(--color-status-pending-text)] focus:ring-[var(--color-warning-border)]"
                  : "border-[var(--color-border-subtle)] text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:ring-[var(--color-brand-primary-muted)]"
              }`}
          />
        </div>

        <div className="rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
          <label className="text-[11px] font-medium text-[var(--color-text-muted)]">
            {t.receiving.diff}
          </label>
          <div
            className={`mt-1 rounded-lg px-2 py-2 text-center text-base font-bold ${
              discrepancy === 0
                ? "bg-[var(--color-success-bg-muted)] text-[var(--color-success-text-strong)]"
                : discrepancy > 0
                  ? "bg-[var(--color-status-approved-bg-muted)] text-[var(--color-status-approved-text)]"
                  : "bg-[var(--color-error-bg-muted)] text-[var(--color-error-text)]"
            }`}
          >
            {hasStarted ? (discrepancy > 0 ? `+${discrepancy}` : discrepancy) : "0"}
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
        <div className="mb-2 flex items-center justify-between text-[11px]">
          <span className="font-medium text-[var(--color-text-secondary)]">
            {t.receiving.progressLabel}
          </span>
          <span className="font-semibold text-[var(--color-text-primary)]">
            {item.actual_quantity} / {item.expected_quantity}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-neutral-100)]">
          <div
            className={`h-full rounded-full transition-all ${
              hasDiscrepancy
                ? "bg-[var(--color-status-pending-icon)]"
                : "bg-[var(--color-brand-primary)]"
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => setShowNotes(!showNotes)}
        className="mt-3 flex items-center gap-1 text-xs text-[var(--color-text-muted)] transition-colors hover:text-[var(--color-text-secondary)]"
      >
        {showNotes ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        {t.receiving.notes}
      </button>

      {showNotes && (
        <textarea
          value={item.notes}
          onChange={(e) => onNotesChange(item.id, e.target.value)}
          placeholder={t.receiving.notesPlaceholder}
          rows={2}
          className="mt-1.5 w-full rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 py-2 
            text-xs text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-muted)] 
            focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-brand-primary-muted)]"
        />
      )}
    </div>
  );
}
