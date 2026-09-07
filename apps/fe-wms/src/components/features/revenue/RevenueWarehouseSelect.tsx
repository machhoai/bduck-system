"use client";

import { Building2 } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

interface RevenueWarehouseSelectProps {
  options: { id: string; name: string }[];
  value: string;
  disabled: boolean;
  onChange: (id: string) => void;
}

export default function RevenueWarehouseSelect({
  options,
  value,
  disabled,
  onChange,
}: RevenueWarehouseSelectProps) {
  const { t } = useTranslation();
  const copy = t.revenue.filters;
  return (
    <label className="flex min-h-14 items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 shadow-sm">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] text-[var(--color-text-muted)]">
        <Building2 size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-xxs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {copy.warehouse}
        </span>
        <select
          aria-label={copy.warehouse}
          value={value}
          disabled={disabled || options.length === 0}
          onChange={(event) => onChange(event.target.value)}
          className="mt-0.5 h-6 w-full min-w-0 appearance-none bg-transparent text-sm font-semibold text-[var(--color-text-primary)] outline-none disabled:opacity-60"
        >
          {options.length === 0 && <option value="">{copy.noWarehouse}</option>}
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
      </span>
    </label>
  );
}
