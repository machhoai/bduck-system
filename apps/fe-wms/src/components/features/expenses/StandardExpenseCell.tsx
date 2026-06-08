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

const formatVNDInput = (val: string): string => {
  const clean = val.replace(/\D/g, "");
  if (!clean) return "";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

const parseVNDInput = (val: string): number => {
  const clean = val.replace(/\./g, "");
  return parseFloat(clean) || 0;
};

export default function StandardExpenseCell({
  value,
  canWrite,
  onSave,
  placeholder = "0",
}: StandardExpenseCellProps) {
  const [localValue, setLocalValue] = useState(formatVNDInput(String(value)));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync when external value changes
  useEffect(() => {
    setLocalValue(formatVNDInput(String(value)));
  }, [value]);

  const handleSave = useCallback(async () => {
    const numericValue = parseVNDInput(localValue);
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
      type="text"
      inputMode="numeric"
      className={`h-8 w-full rounded-radius-xs border border-border-subtle bg-surface-input
        px-2 text-sm tabular-nums text-text-primary
        focus:border-brand-primary focus:outline-none
        disabled:opacity-50`}
      value={localValue}
      onChange={(e) => setLocalValue(formatVNDInput(e.target.value))}
      onBlur={handleSave}
      onKeyDown={handleKeyDown}
      disabled={saving}
      placeholder={placeholder}
    />
  );
}
