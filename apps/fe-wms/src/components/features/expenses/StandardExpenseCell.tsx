"use client";

/**
 * StandardExpenseCell — Inline number input for expense items
 *
 * If !canWrite: renders as plain text (read-only)
 * If canWrite: renders an h-8 input that saves on blur/Enter
 */

import { useState, useCallback, useRef, useEffect } from "react";

interface StandardExpenseCellProps {
  value: number;
  canWrite: boolean;
  onSave: (value: number) => void;
  placeholder?: string;
}

export default function StandardExpenseCell({
  value,
  canWrite,
  onSave,
  placeholder = "0",
}: StandardExpenseCellProps) {
  const [localValue, setLocalValue] = useState(String(value));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when external value changes
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

  if (!canWrite) {
    return (
      <span className="text-sm tabular-nums text-text-primary">
        {value.toLocaleString("vi-VN")} đ
      </span>
    );
  }

  return (
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
      placeholder={placeholder}
      min={0}
      step="any"
    />
  );
}
