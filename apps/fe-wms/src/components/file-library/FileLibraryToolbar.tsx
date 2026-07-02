"use client";

import { FileSpreadsheet, FileText, Filter, Search, X } from "lucide-react";
import type { Dictionary } from "@/lib/i18n";
import type {
  FileLibraryFilters,
  FileLibraryFormat,
  FileLibrarySourceType,
} from "@/utils/fileLibrary";

interface FileLibraryToolbarProps {
  filters: FileLibraryFilters;
  onChange: (filters: FileLibraryFilters) => void;
  t: Dictionary["fileLibrary"];
  hideSourceFilter?: boolean;
}

const sourceOptions: Array<FileLibrarySourceType | "ALL"> = [
  "ALL",
  "IMPORT_VOUCHER",
  "EXPORT_VOUCHER",
  "TRANSFER_ORDER",
];

const formatOptions: Array<FileLibraryFormat | "ALL"> = [
  "ALL",
  "pdf",
  "docx",
  "xlsx",
  "csv",
];

export default function FileLibraryToolbar({
  filters,
  onChange,
  t,
  hideSourceFilter = false,
}: FileLibraryToolbarProps) {
  const update = <K extends keyof FileLibraryFilters>(
    key: K,
    value: FileLibraryFilters[K],
  ) => onChange({ ...filters, [key]: value });

  const reset = () => {
    onChange({ search: "", sourceType: "ALL", format: "ALL" });
  };

  const hasFilters =
    Boolean(filters.search) ||
    filters.sourceType !== "ALL" ||
    filters.format !== "ALL";

  return (
    <div className="flex flex-col gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <label className="flex h-8 flex-1 items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 transition focus-within:border-[var(--color-border-focus)]">
          <Search
            size={15}
            className="shrink-0 text-[var(--color-text-muted)]"
          />
          <input
            value={filters.search}
            onChange={(event) => update("search", event.target.value)}
            placeholder={t.searchPlaceholder}
            className="h-full min-w-0 flex-1 bg-transparent text-sm text-[var(--color-text-primary)] outline-none"
          />
        </label>

        {hasFilters && (
          <button
            type="button"
            onClick={reset}
            className="flex h-8 w-fit items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-3 text-sm font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)]"
          >
            <X size={14} />
            {t.clearFilters}
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        {!hideSourceFilter && (
          <div className="flex items-center gap-1 overflow-x-auto">
            <span className="flex h-7 shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-xs font-semibold text-[var(--color-text-muted)]">
              <Filter size={13} />
              {t.sourceFilter}
            </span>
            {sourceOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => update("sourceType", option)}
                className={`h-7 shrink-0 rounded-[var(--radius-sm)] px-2 text-xs font-semibold transition ${
                  filters.sourceType === option
                    ? "bg-[var(--color-brand-primary)] text-[var(--color-text-on-dark)]"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-primary-muted)] hover:text-[var(--color-brand-primary)]"
                }`}
              >
                {option === "ALL" ? t.allSources : t.sources[option]}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 overflow-x-auto">
          <span className="flex h-7 shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-xs font-semibold text-[var(--color-text-muted)]">
            <FileText size={13} />
            {t.formatFilter}
          </span>
          {formatOptions.map((option) => {
            const Icon = option === "xlsx" || option === "csv"
              ? FileSpreadsheet
              : FileText;
            return (
              <button
                key={option}
                type="button"
                onClick={() => update("format", option)}
                className={`flex h-7 shrink-0 items-center gap-1 rounded-[var(--radius-sm)] px-2 text-xs font-semibold uppercase transition ${
                  filters.format === option
                    ? "bg-[var(--color-neutral-900)] text-[var(--color-text-on-dark)]"
                    : "bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-200)]"
                }`}
              >
                {option !== "ALL" && <Icon size={12} />}
                {option === "ALL" ? t.allFormats : option}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
