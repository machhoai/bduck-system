"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  FileSpreadsheet,
  FileText,
  Files,
  FolderOpen,
  Library,
  LockKeyhole,
} from "lucide-react";
import { useFileLibrary } from "@/hooks/useFileLibrary";
import { useFileTemplates } from "@/hooks/useFileTemplates";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import {
  filterFileLibraryItems,
  type FileLibraryFilters,
  type FileLibraryFormat,
} from "@/utils/fileLibrary";
import FileLibrarySkeleton from "./FileLibrarySkeleton";
import FileLibraryTable from "./FileLibraryTable";
import FileLibraryToolbar from "./FileLibraryToolbar";
import FileTemplateGrid from "./FileTemplateGrid";
import FileTemplateUploadPanel from "./FileTemplateUploadPanel";

type FileLibraryTab = "uploaded" | "templates";

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
  icon: ReactNode;
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
  const hasPermission = useUserStore((state) => state.hasPermission);
  const { files, loading, canViewAll } = useFileLibrary();
  const canViewTemplates = hasPermission("file_templates.view");
  const canUploadTemplates = hasPermission("file_templates.upload");
  const canAccessTemplates = canViewTemplates || canUploadTemplates;
  const {
    templates,
    loading: templatesLoading,
    getUploaderName,
    createTemplate,
  } = useFileTemplates(canViewTemplates);

  const [activeTab, setActiveTab] = useState<FileLibraryTab>("uploaded");
  const [uploadedFilters, setUploadedFilters] =
    useState<FileLibraryFilters>(defaultFilters);
  const [templateFilters, setTemplateFilters] =
    useState<FileLibraryFilters>(defaultFilters);

  const copy = t.fileLibrary;
  const purposeResolver = (key: (typeof files)[number]["purposeKey"]) =>
    copy.purposes[key];

  useEffect(() => {
    if (!canAccessTemplates && activeTab === "templates") {
      setActiveTab("uploaded");
    }
  }, [activeTab, canAccessTemplates]);

  const filteredFiles = useMemo(
    () => filterFileLibraryItems(files, uploadedFilters, purposeResolver),
    [files, uploadedFilters, purposeResolver],
  );

  const filteredTemplates = useMemo(() => {
    const keyword = templateFilters.search.trim().toLowerCase();
    return templates.filter((template) => {
      if (
        templateFilters.format !== "ALL" &&
        template.file_format !== templateFilters.format
      ) {
        return false;
      }
      if (!keyword) return true;
      return [
        template.title,
        template.description || "",
        template.file_name,
        template.file_format,
        getUploaderName(template.uploaded_by),
      ]
        .join(" ")
        .toLowerCase()
        .includes(keyword);
    });
  }, [getUploaderName, templateFilters, templates]);

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
    <div className="flex min-h-full flex-col gap-3 pb-4">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-center">
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

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 py-2">
            <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
              {copy.visibleCount}
            </p>
            <p className="text-base font-bold text-[var(--color-text-primary)]">
              {activeTab === "uploaded"
                ? `${filteredFiles.length}/${files.length}`
                : `${filteredTemplates.length}/${templates.length}`}
            </p>
          </div>
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 py-2">
            <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
              {copy.scope}
            </p>
            <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
              {canViewAll ? copy.allUploadedFiles : copy.myUploadedFiles}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <MetricCard
          label={copy.metrics.total}
          value={counts.total}
          tone="bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]"
          icon={<Files size={17} />}
        />
        <MetricCard label="PDF" value={counts.pdf} tone={metricTone.pdf} icon={<FileText size={17} />} />
        <MetricCard label="DOCX" value={counts.docx} tone={metricTone.docx} icon={<FileText size={17} />} />
        <MetricCard label="XLSX" value={counts.xlsx} tone={metricTone.xlsx} icon={<FileSpreadsheet size={17} />} />
        <MetricCard label="CSV" value={counts.csv} tone={metricTone.csv} icon={<FileSpreadsheet size={17} />} />
      </div>

      <div className="grid grid-cols-1 gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setActiveTab("uploaded")}
          className={`flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] text-sm font-bold transition ${
            activeTab === "uploaded"
              ? "bg-[var(--color-brand-primary)] text-[var(--color-text-on-dark)]"
              : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
          }`}
        >
          <Files size={16} />
          {copy.tabs.uploadedFiles}
        </button>
        {canAccessTemplates && (
          <button
            type="button"
            onClick={() => setActiveTab("templates")}
            className={`flex h-10 items-center justify-center gap-2 rounded-[var(--radius-sm)] text-sm font-bold transition ${
              activeTab === "templates"
                ? "bg-[var(--color-brand-primary)] text-[var(--color-text-on-dark)]"
                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
            }`}
          >
            <Library size={16} />
            {copy.tabs.templates}
          </button>
        )}
      </div>

      {activeTab === "uploaded" ? (
        <>
          <FileLibraryToolbar
            filters={uploadedFilters}
            onChange={setUploadedFilters}
            t={copy}
          />
          <FileLibraryTable files={filteredFiles} t={copy} lang={lang} />
        </>
      ) : (
        <div className="grid gap-3">
          {canUploadTemplates && (
            <FileTemplateUploadPanel t={copy} onCreate={createTemplate} />
          )}

          {canViewTemplates ? (
            <>
              <FileLibraryToolbar
                filters={templateFilters}
                onChange={setTemplateFilters}
                t={copy}
                hideSourceFilter
              />
              {templatesLoading ? (
                <FileLibrarySkeleton compact />
              ) : (
                <FileTemplateGrid
                  templates={filteredTemplates}
                  t={copy}
                  lang={lang}
                  getUploaderName={getUploaderName}
                />
              )}
            </>
          ) : (
            <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 text-center">
              <LockKeyhole size={28} className="text-[var(--color-text-muted)]" />
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {copy.templates.noViewTitle}
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {copy.templates.noViewHint}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
