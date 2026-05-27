/**
 * Reusable form field components for workflow config sub-forms.
 * DRY: all sub-forms share the same label/input/select styling.
 */
"use client";

import type { ReactNode } from "react";

interface ConfigFieldProps {
  label: string;
  children: ReactNode;
  /** Optional hint text shown below the input */
  hint?: string;
}

/** Wrapped label + input with consistent spacing & typography */
export function ConfigField({ label, children, hint }: ConfigFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </label>
      {children}
      {hint && (
        <p className="mt-1 text-[10px] text-[var(--color-text-muted)]">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Standard text input with Light Theme styling */
export function ConfigInput({
  value,
  onChange,
  onBlur,
  placeholder,
  type = "text",
  disabled = false,
}: {
  value: string | number;
  onChange: (val: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  type?: "text" | "number";
  disabled?: boolean;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      disabled={disabled}
      className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

/** Standard select dropdown with Light Theme styling */
export function ConfigSelect({
  value,
  onChange,
  onBlur,
  options,
  placeholder,
}: {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  options: { value: string; label: string }[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => {
        onChange(e.target.value);
        onBlur?.();
      }}
      className="w-full rounded-[var(--radius-md)] border border-[var(--color-border-default)] bg-white px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-brand-primary)] focus:ring-1 focus:ring-[var(--color-brand-primary)]/20"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
