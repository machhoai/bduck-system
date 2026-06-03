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
import { AlertTriangle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import type { ReceivingItem } from "@/stores/useReceivingStore";

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
  const [showNotes, setShowNotes] = useState(false);

  const discrepancy = item.actual_quantity - item.expected_quantity;
  const hasDiscrepancy = discrepancy !== 0 && item.actual_quantity > 0;
  const isComplete = item.actual_quantity === item.expected_quantity && item.actual_quantity > 0;

  const handleBlur = useCallback(
    (e: React.FocusEvent<HTMLInputElement>) => {
      const val = parseInt(e.target.value, 10);
      onQuantityChange(item.id, isNaN(val) ? 0 : val);
    },
    [item.id, onQuantityChange],
  );

  return (
    <div
      className={`rounded-xl border p-3 transition-all duration-300
        ${isHighlighted ? "border-[var(--color-status-approved-icon)] bg-[var(--color-status-approved-bg)] ring-2 ring-[var(--color-status-approved-border)]" : ""}
        ${hasDiscrepancy ? "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)]/50" : ""}
        ${isComplete ? "border-[var(--color-success-border)] bg-[var(--color-success-bg)]/30" : ""}
        ${!isHighlighted && !hasDiscrepancy && !isComplete ? "border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]" : ""}
      `}
    >
      {/* Product info */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {item.product_name}
          </p>
          <p className="text-xs text-[var(--color-text-muted)] font-mono">{item.product_sku}</p>
          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{item.location_name}</p>
        </div>

        {/* Status indicator */}
        {isComplete && (
          <CheckCircle className="h-5 w-5 text-[var(--color-success-icon)] flex-shrink-0" />
        )}
        {hasDiscrepancy && (
          <AlertTriangle className="h-5 w-5 text-[var(--color-status-pending-icon)] flex-shrink-0" />
        )}
      </div>

      {/* Quantity row */}
      <div className="mt-2.5 flex items-center gap-3">
        <div className="flex-1">
          <label className="text-xs text-[var(--color-text-muted)]">Dự kiến</label>
          <div className="mt-0.5 rounded-lg bg-[var(--color-neutral-100)] px-3 py-2 text-sm font-medium text-[var(--color-text-secondary)] text-center">
            {item.expected_quantity}
          </div>
        </div>

        <div className="flex-1">
          <label className="text-xs text-[var(--color-text-muted)]">Thực nhận</label>
          <input
            type="number"
            min={0}
            defaultValue={item.actual_quantity}
            onBlur={handleBlur}
            className={`mt-0.5 w-full rounded-lg border px-3 py-2 text-sm font-semibold text-center outline-none
              transition-colors focus:ring-2
              ${
                hasDiscrepancy
                  ? "border-[var(--color-status-pending-border)] text-[var(--color-status-pending-text)] focus:ring-[var(--color-warning-border)]"
                  : "border-[var(--color-border-subtle)] text-[var(--color-text-primary)] focus:border-[var(--color-border-focus)] focus:ring-[var(--color-brand-primary-muted)]"
              }`}
          />
        </div>

        {item.actual_quantity > 0 && (
          <div className="flex-shrink-0 w-14 text-center">
            <label className="text-xs text-[var(--color-text-muted)]">Lệch</label>
            <div
              className={`mt-0.5 rounded-lg px-2 py-2 text-sm font-bold
                ${
                  discrepancy === 0
                    ? "bg-[var(--color-success-bg-muted)] text-[var(--color-success-text-strong)]"
                    : discrepancy > 0
                      ? "bg-[var(--color-status-approved-bg-muted)] text-[var(--color-status-approved-text)]"
                      : "bg-[var(--color-error-bg-muted)] text-[var(--color-error-text)]"
                }`}
            >
              {discrepancy > 0 ? `+${discrepancy}` : discrepancy}
            </div>
          </div>
        )}
      </div>

      {/* Notes toggle */}
      <button
        type="button"
        onClick={() => setShowNotes(!showNotes)}
        className="mt-2 flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        {showNotes ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
        Ghi chú
      </button>

      {showNotes && (
        <textarea
          value={item.notes}
          onChange={(e) => onNotesChange(item.id, e.target.value)}
          placeholder="Nhập ghi chú cho sản phẩm này..."
          rows={2}
          className="mt-1.5 w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 py-2 
            text-xs text-[var(--color-text-secondary)] outline-none placeholder:text-[var(--color-text-muted)] 
            focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-brand-primary-muted)]"
        />
      )}
    </div>
  );
}
