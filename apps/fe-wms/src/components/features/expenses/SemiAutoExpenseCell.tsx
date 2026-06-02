"use client";

/**
 * SemiAutoExpenseCell — For COGS and GIFT_EXPENSE categories
 *
 * Contains the same inline input as StandardExpenseCell,
 * PLUS a suggested_amount hint with an "Apply" button.
 * All text via i18n t.expenses.hint.*
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "@/lib/i18n";
import { Sparkles } from "lucide-react";

interface SemiAutoExpenseCellProps {
  value: number;
  suggestedAmount: number | null;
  canWrite: boolean;
  onSave: (value: number) => void;
}

export default function SemiAutoExpenseCell({
  value,
  suggestedAmount,
  canWrite,
  onSave,
}: SemiAutoExpenseCellProps) {
  const { t } = useTranslation();
  const [localValue, setLocalValue] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalValue(String(value));
  }, [value]);

  const handleSave = useCallback(async () => {
    const numericValue = parseFloat(localValue) || 0;
    if (numericValue === value) return;
    setSaving(true);
    try {
      onSave(numericValue);
    } finally {
      setSaving(false);
    }
  }, [localValue, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        inputRef.current?.blur();
      }
    },
    [],
  );

  const handleApplySuggestion = useCallback(() => {
    if (suggestedAmount == null) return;
    setLocalValue(String(suggestedAmount));
    onSave(suggestedAmount);
  }, [suggestedAmount, onSave]);

  if (!canWrite) {
    return (
      <div className="flex flex-col gap-0.5">
        <span className="text-sm tabular-nums text-text-primary">
          {value.toLocaleString("vi-VN")} đ
        </span>
        {suggestedAmount != null && suggestedAmount > 0 && (
          <span className="text-xxs text-text-muted flex items-center gap-0.5">
            <Sparkles size={10} className="text-accent-warning" />
            {t.expenses.hint.suggested}: {suggestedAmount.toLocaleString("vi-VN")} đ
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <input
        ref={inputRef}
        type="number"
        className={`h-8 w-full rounded-radius-xs border border-border-subtle bg-surface-input
          px-2 text-sm tabular-nums text-text-primary
          focus:border-brand-primary focus:outline-none
          disabled:opacity-50
          [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none
          [&::-webkit-outer-spin-button]:appearance-none`}
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={handleKeyDown}
        disabled={saving}
        placeholder="0"
        min={0}
        step="any"
      />
      {suggestedAmount != null && suggestedAmount > 0 && (
        <div className="flex items-center gap-1">
          <Sparkles size={10} className="text-accent-warning shrink-0" />
          <span className="text-xxs text-text-muted tabular-nums">
            {t.expenses.hint.suggested}: {suggestedAmount.toLocaleString("vi-VN")} đ
          </span>
          <button
            type="button"
            onClick={handleApplySuggestion}
            className="h-5 rounded-radius-xs px-1.5 text-micro font-medium
              bg-brand-primary-muted text-brand-primary
              hover:bg-brand-primary hover:text-text-on-dark
              transition-colors w-fit ml-auto"
          >
            {t.expenses.hint.apply}
          </button>
        </div>
      )}
    </div>
  );
}
