"use client";

import { useMemo, useState } from "react";
import { FileSpreadsheet, FileText, Files, FolderOpen } from "lucide-react";
import { useFileLibrary } from "@/hooks/useFileLibrary";
import { useTranslation } from "@/lib/i18n";
import {
  filterFileLibraryItems,
  type FileLibraryFilters,
  type FileLibraryFormat,
} from "@/utils/fileLibrary";
import FileLibrarySkeleton from "./FileLibrarySkeleton";
import FileLibraryTable from "./FileLibraryTable";
import FileLibraryToolbar from "./FileLibraryToolbar";

const defaultFilters: FileLibraryFilters = {
  search: "",
  sourceType: "ALL",
  format: "ALL",
};

const metricTone: Record<FileLibraryFormat, string> = {
  pdf: "bg-[var(--color-error-bg)] text-[var(--color-error-text)]",
  docx: "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]",
  xlsx: "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)]",
  csv: "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
  other: "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)]",
};

function MetricCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
      <div className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] ${tone}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
          {label}
        </p>
        <p className="text-base font-bold text-[var(--color-text-primary)]">
          {value}
        </p>
      </div>
    </div>
  );
}

export default function FileLibraryPage() {
  const { t, lang } = useTranslation();
  const { files, loading } = useFileLibrary();
  const [filters, setFilters] = useState<FileLibraryFilters>(defaultFilters);

  const copy = t.fileLibrary;
  const purposeResolver = (key: (typeof files)[number]["purposeKey"]) =>
    copy.purposes[key];

  const filteredFiles = useMemo(
    () => filterFileLibraryItems(files, filters, purposeResolver),
    [files, filters, purposeResolver],
  );

  const counts = useMemo(
    () =>
      files.reduce(
        (acc, file) => {
          acc.total += 1;
          acc[file.format] += 1;
          return acc;
        },
        { total: 0, pdf: 0, docx: 0, xlsx: 0, csv: 0, other: 0 },
      ),
    [files],
  );

  if (loading) {
    return <FileLibrarySkeleton />;
  }

  return (
    <div className="flex min-h-full flex-col gap-3 pb-24 lg:pb-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
            <FolderOpen size={21} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-normal text-[var(--color-text-primary)]">
              {copy.title}
            </h1>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {copy.subtitle}
            </p>
          </div>
        </div>

        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 py-2">
          <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
            {copy.visibleCount}
          </p>
          <p className="text-base font-bold text-[var(--color-text-primary)]">
            {filteredFiles.length}/{files.length}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <MetricCard
          label={copy.metrics.total}
          value={counts.total}
          tone="bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]"
          icon={<Files size={17} />}
        />
        <MetricCard
          label="PDF"
          value={counts.pdf}
          tone={metricTone.pdf}
          icon={<FileText size={17} />}
        />
        <MetricCard
          label="DOCX"
          value={counts.docx}
          tone={metricTone.docx}
          icon={<FileText size={17} />}
        />
        <MetricCard
          label="XLSX"
          value={counts.xlsx}
          tone={metricTone.xlsx}
          icon={<FileSpreadsheet size={17} />}
        />
        <MetricCard
          label="CSV"
          value={counts.csv}
          tone={metricTone.csv}
          icon={<FileSpreadsheet size={17} />}
        />
      </div>

      <FileLibraryToolbar filters={filters} onChange={setFilters} t={copy} />

      <FileLibraryTable files={filteredFiles} t={copy} lang={lang} />
    </div>
  );
}
