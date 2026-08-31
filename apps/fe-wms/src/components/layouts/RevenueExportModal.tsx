"use client";

import type { RevenueExportReportType } from "@bduck/shared-types";
import { CalendarRange, Download, PackageSearch, Store, X } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { useTranslation } from "@/lib/i18n";
import type {
  ExportRequestOptions,
  RevenueExportDialogConfig,
} from "@/utils/exportExcel";

interface RevenueExportModalProps {
  isOpen: boolean;
  config: RevenueExportDialogConfig;
  isExporting: boolean;
  onClose: () => void;
  onSubmit: (options: ExportRequestOptions) => Promise<void>;
}

export function RevenueExportModal({
  isOpen,
  config,
  isExporting,
  onClose,
  onSubmit,
}: RevenueExportModalProps) {
  const { t } = useTranslation();
  const copy = t.revenue.export;
  const titleId = useId();
  const descriptionId = useId();
  const [reportType, setReportType] =
    useState<RevenueExportReportType>("DAILY_REVENUE");

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isExporting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isExporting, isOpen, onClose]);

  if (!isOpen) return null;

  const options = [
    {
      value: "DAILY_REVENUE" as const,
      label: copy.dailyRevenue,
      description: copy.dailyRevenueDescription,
      icon: CalendarRange,
    },
    {
      value: "SALES_COMPOSITION" as const,
      label: copy.salesComposition,
      description: copy.salesCompositionDescription,
      icon: PackageSearch,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isExporting) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-xl overflow-hidden rounded-[var(--radius-xl)] border border-[var(--color-border-subtle)] bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-[var(--color-border-subtle)] px-5 py-4">
          <div>
            <h2
              id={titleId}
              className="text-lg font-bold text-[var(--color-text-primary)]"
            >
              {config.title}
            </h2>
            <p
              id={descriptionId}
              className="mt-1 text-sm text-[var(--color-text-muted)]"
            >
              {config.description}
            </p>
          </div>
          <button
            type="button"
            aria-label={copy.close}
            disabled={isExporting}
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-card)] disabled:opacity-50"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="space-y-4 p-5">
          {(config.warehouseName ||
            config.sourceLabel ||
            config.rangeLabel) && (
            <div className="grid gap-2 rounded-[var(--radius-md)] bg-[var(--color-surface-pearl)] p-3 text-xs sm:grid-cols-3">
              <ExportContext
                label={copy.warehouseLabel}
                value={config.warehouseName}
              />
              <ExportContext
                label={copy.sourceLabel}
                value={config.sourceLabel}
              />
              <ExportContext
                label={copy.rangeLabel}
                value={config.rangeLabel}
              />
            </div>
          )}

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-semibold text-[var(--color-text-secondary)]">
              {copy.reportTypeLabel}
            </legend>
            {options.map((option) => {
              const Icon = option.icon;
              const selected = reportType === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  autoFocus={selected}
                  onClick={() => setReportType(option.value)}
                  className={`flex w-full items-center gap-3 rounded-[var(--radius-md)] border p-3 text-left transition ${
                    selected
                      ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-500"
                      : "border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-card)]"
                  }`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] ${selected ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700"}`}
                  >
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[var(--color-text-primary)]">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs leading-5 text-[var(--color-text-muted)]">
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </fieldset>
        </div>

        <footer className="flex justify-end gap-2 border-t border-[var(--color-border-subtle)] px-5 py-3">
          <button
            type="button"
            disabled={isExporting}
            onClick={onClose}
            className="h-9 rounded-full border border-[var(--color-border-subtle)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)] disabled:opacity-50"
          >
            {copy.cancel}
          </button>
          <button
            type="button"
            disabled={isExporting}
            onClick={() => void onSubmit({ reportType })}
            className="flex h-9 items-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
          >
            <Download size={16} aria-hidden="true" />
            {isExporting ? copy.loading : copy.confirm}
          </button>
        </footer>
      </section>
    </div>
  );
}

function ExportContext({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <span className="flex items-center gap-1 font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        <Store size={12} aria-hidden="true" /> {label}
      </span>
      <span className="mt-1 block truncate font-bold text-[var(--color-text-primary)]">
        {value}
      </span>
    </div>
  );
}
