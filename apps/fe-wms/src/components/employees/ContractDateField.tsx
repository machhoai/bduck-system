"use client";

import { normalizeContractDateInput } from "@/utils/contractDateInput";

interface ContractDateFieldProps {
  id: string;
  label: string;
  value: string;
  hint: string;
  disabled?: boolean;
  required?: boolean;
  error?: string | null;
  onChange: (value: string) => void;
}

export function ContractDateField({
  id,
  label,
  value,
  hint,
  disabled = false,
  required = false,
  error,
  onChange,
}: ContractDateFieldProps) {
  const descriptionId = `${id}-description`;
  return (
    <label htmlFor={id} className="block">
      <span className="mb-1.5 block text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
        {required ? <span className="ml-1 text-red-600">*</span> : null}
      </span>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="DD-MM-YYYY"
        value={value}
        disabled={disabled}
        required={required}
        maxLength={10}
        aria-describedby={descriptionId}
        aria-invalid={Boolean(error)}
        onChange={(event) =>
          onChange(normalizeContractDateInput(event.target.value))
        }
        className="h-10 w-full rounded-xl border border-[var(--color-border-subtle)] bg-white px-3 text-sm tabular-nums outline-none focus:border-[var(--color-border-focus)] disabled:bg-[var(--color-surface-card)] disabled:text-[var(--color-text-muted)]"
      />
      <span
        id={descriptionId}
        className={`mt-1 block text-xxs ${error ? "text-red-600" : "text-[var(--color-text-muted)]"}`}
      >
        {error || hint}
      </span>
    </label>
  );
}
