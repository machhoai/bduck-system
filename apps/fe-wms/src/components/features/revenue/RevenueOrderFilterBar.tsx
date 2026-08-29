"use client";

import { RotateCcw, Search } from "lucide-react";

import { useTranslation } from "@/lib/i18n";

import type { RevenueOrderFilters } from "./revenueOrderFilters";

interface RevenueOrderFilterBarProps {
  filters: RevenueOrderFilters;
  options: {
    employees: string[];
    statuses: string[];
    payments: string[];
  };
  onChange: (patch: Partial<RevenueOrderFilters>) => void;
  onClear: () => void;
}

export default function RevenueOrderFilterBar({
  filters,
  options,
  onChange,
  onClear,
}: RevenueOrderFilterBarProps) {
  const { t } = useTranslation();
  const copy = t.revenue.orders.filters;

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-12">
      <label className="relative xl:col-span-4">
        <span className="sr-only">{copy.search}</span>
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          aria-hidden="true"
        />
        <input
          value={filters.search}
          onChange={(event) => onChange({ search: event.target.value })}
          placeholder={copy.search}
          className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white pl-9 pr-3 text-xs font-semibold text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)]"
        />
      </label>
      <FilterSelect
        value={filters.employee}
        onChange={(employee) => onChange({ employee })}
        options={options.employees}
        placeholder={copy.employee}
      />
      <FilterSelect
        value={filters.status}
        onChange={(status) => onChange({ status })}
        options={options.statuses}
        placeholder={copy.status}
      />
      <FilterSelect
        value={filters.payment}
        onChange={(payment) => onChange({ payment })}
        options={options.payments}
        placeholder={copy.payment}
      />
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_40px] gap-2 xl:col-span-4">
        <AmountInput
          value={filters.minAmount}
          onChange={(minAmount) => onChange({ minAmount })}
          placeholder={copy.minAmount}
        />
        <AmountInput
          value={filters.maxAmount}
          onChange={(maxAmount) => onChange({ maxAmount })}
          placeholder={copy.maxAmount}
        />
        <button
          type="button"
          onClick={onClear}
          title={copy.clear}
          aria-label={copy.clear}
          className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
        >
          <RotateCcw size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder: string;
}) {
  return (
    <select
      aria-label={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-10 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-xs font-semibold text-[var(--color-text-secondary)] outline-none transition-colors focus:border-[var(--color-border-focus)] xl:col-span-2"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

function AmountInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <input
      type="number"
      min="0"
      aria-label={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 min-w-0 w-full rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white px-3 text-xs font-semibold text-[var(--color-text-secondary)] outline-none transition-colors focus:border-[var(--color-border-focus)]"
    />
  );
}
