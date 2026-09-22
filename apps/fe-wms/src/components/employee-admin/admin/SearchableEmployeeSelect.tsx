"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

export interface SearchableEmployeeOption {
  id: string;
  employee_code: string;
  full_name: string;
}

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLocaleLowerCase("vi")
    .trim();

export function SearchableEmployeeSelect({
  labels,
  options,
  value,
  disabled,
  onChange,
}: {
  labels: Record<string, string>;
  options: SearchableEmployeeOption[];
  value: string;
  disabled: boolean;
  onChange: (profileId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const visibleOptions = useMemo(() => {
    const normalizedQuery = normalizeSearchText(query);
    if (!normalizedQuery) return options;
    const matches = options.filter((option) =>
      normalizeSearchText(
        `${option.employee_code} ${option.full_name}`,
      ).includes(normalizedQuery),
    );
    const selected = options.find((option) => option.id === value);
    return selected && !matches.some((option) => option.id === selected.id)
      ? [selected, ...matches]
      : matches;
  }, [options, query, value]);

  return (
    <div className="space-y-2">
      <label className="relative block">
        <Search
          aria-hidden="true"
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
        />
        <input
          type="search"
          value={query}
          disabled={disabled}
          aria-label={labels.searchEmployeeLeave}
          placeholder={labels.searchEmployeeLeave}
          onChange={(event) => setQuery(event.target.value)}
          className="h-11 w-full rounded-xl border border-[var(--color-border-soft)] bg-white pl-9 pr-3 text-sm outline-none focus:border-[var(--color-brand-primary)] disabled:opacity-50"
        />
      </label>
      <select
        value={value}
        disabled={disabled}
        aria-label={labels.selectEmployee}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-[var(--color-border-soft)] bg-white px-3 text-sm"
      >
        <option value="">{labels.selectEmployee}</option>
        {visibleOptions.map((option) => (
          <option key={option.id} value={option.id}>
            {option.employee_code} · {option.full_name}
          </option>
        ))}
      </select>
      {query && visibleOptions.length === 0 ? (
        <p className="px-1 text-xs text-[var(--color-text-muted)]">
          {labels.employeeSearchEmpty}
        </p>
      ) : null}
    </div>
  );
}
