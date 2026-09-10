"use client";

import { Plus, X } from "lucide-react";
import { useRef } from "react";

export function RevenueMultiValueInput({
  label,
  type,
  value,
  onChange,
  onCommit,
}: {
  label: string;
  type: "date" | "month" | "number";
  value: string;
  onChange: (value: string) => void;
  onCommit: (value?: string) => void;
}) {
  const commitIfComplete = (nextValue: string) => {
    if (type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(nextValue)) {
      onCommit(nextValue);
    }
    if (type === "month" && /^\d{4}-\d{2}$/.test(nextValue)) {
      onCommit(nextValue);
    }
    if (type === "number" && /^\d{4}$/.test(nextValue)) {
      onCommit(nextValue);
    }
  };

  return (
    <div className="flex items-center gap-1">
      <RevenueDateInput
        label={label}
        type={type}
        value={value}
        onChange={(nextValue) => {
          onChange(nextValue);
          commitIfComplete(nextValue);
        }}
      />
      <button
        type="button"
        onClick={() => onCommit()}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] text-[var(--color-text-muted)] transition-colors hover:bg-white hover:text-[var(--color-text-primary)]"
        aria-label={label}
      >
        <Plus size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

export function RevenueComparisonChips({
  values,
  onRemove,
}: {
  values: string[];
  onRemove: (value: string) => void;
}) {
  return (
    <div className="flex max-w-full gap-1 overflow-x-auto py-0.5">
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full bg-[var(--color-surface-card)] px-2 text-xs font-semibold text-[var(--color-text-primary)]"
        >
          {value}
          <button
            type="button"
            onClick={() => onRemove(value)}
            className="flex h-4 w-4 items-center justify-center rounded-full text-[var(--color-text-muted)] hover:bg-[var(--color-neutral-200)] hover:text-[var(--color-text-primary)]"
            aria-label={value}
          >
            <X size={10} aria-hidden="true" />
          </button>
        </span>
      ))}
    </div>
  );
}

export function RevenueDateInput({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: "date" | "month" | "number";
  value: string;
  onChange: (value: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const handleClick = () => {
    if (
      type !== "number" &&
      inputRef.current &&
      typeof inputRef.current.showPicker === "function"
    ) {
      try {
        inputRef.current.showPicker();
      } catch {
        // Older browsers may expose showPicker without allowing it here.
      }
    } else if (
      type === "number" &&
      selectRef.current &&
      typeof selectRef.current.showPicker === "function"
    ) {
      try {
        selectRef.current.showPicker();
      } catch {
        // Older browsers may expose showPicker without allowing it here.
      }
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: currentYear + 5 - 2020 + 1 }, (_, index) =>
    String(2020 + index),
  );

  return (
    <div
      onClick={handleClick}
      className={`flex h-8 w-full min-w-0 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] px-2 transition-colors focus-within:border-[var(--color-brand-primary)] focus-within:bg-white sm:w-auto ${type === "number" ? "sm:min-w-[7rem]" : "sm:min-w-[10rem]"}`}
    >
      {label && (
        <span className="max-w-[58px] shrink-0 select-none truncate whitespace-nowrap text-xs font-semibold text-[var(--color-text-muted)]">
          {label}
        </span>
      )}
      {type === "number" ? (
        <select
          ref={selectRef}
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 min-w-0 flex-1 cursor-pointer bg-transparent text-xs font-semibold text-[var(--color-text-primary)] outline-none"
        >
          {years.map((year) => (
            <option
              key={year}
              value={year}
              className="bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)]"
            >
              {year}
            </option>
          ))}
        </select>
      ) : (
        <input
          ref={inputRef}
          aria-label={label}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-7 min-w-0 flex-1 cursor-pointer bg-transparent text-xs font-semibold text-[var(--color-text-primary)] outline-none"
        />
      )}
    </div>
  );
}
