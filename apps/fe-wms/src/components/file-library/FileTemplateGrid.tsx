"use client";

import { Download, ExternalLink, Library } from "lucide-react";
import type { FileTemplate } from "@bduck/shared-types";
import type { Dictionary, Language } from "@/lib/i18n";
import { toFileLibraryDate } from "@/utils/fileLibrary";
import { FileLibraryFileIcon } from "./FileLibraryFileIcon";

interface FileTemplateGridProps {
  templates: FileTemplate[];
  t: Dictionary["fileLibrary"];
  lang: Language;
  getUploaderName: (userId: string) => string;
}

function formatDate(date: unknown, lang: Language) {
  const normalized = toFileLibraryDate(date);
  if (!normalized) return "-";
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(normalized);
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function FileTemplateGrid({
  templates,
  t,
  lang,
  getUploaderName,
}: FileTemplateGridProps) {
  if (templates.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 text-center">
        <Library size={28} className="text-[var(--color-text-muted)]" />
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t.templates.emptyTitle}
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          {t.templates.emptyHint}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {templates.map((template) => {
        const viewUrl =
          template.file_format === "pdf"
            ? template.file_url
            : `https://docs.google.com/viewer?url=${encodeURIComponent(template.file_url)}`;

        return (
          <article
            key={template.id}
            className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3"
          >
            <div className="flex items-start gap-3">
              <FileLibraryFileIcon
                format={template.file_format}
                extension={template.file_format}
              />
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                  {template.title}
                </h3>
                <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                  {template.file_name}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={viewUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-primary-muted)]"
                  title={t.openFile}
                  aria-label={t.openFile}
                >
                  <ExternalLink size={14} />
                </a>
                <a
                  href={template.file_url}
                  download={template.file_name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-secondary)]"
                  title={t.download}
                  aria-label={t.download}
                >
                  <Download size={14} />
                </a>
              </div>
            </div>

            {template.description && (
              <p className="line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                {template.description}
              </p>
            )}

            <div className="grid grid-cols-2 gap-2 border-t border-[var(--color-border-soft)] pt-2 text-xs">
              <div className="min-w-0">
                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                  {t.columns.uploader}
                </p>
                <p className="truncate text-[var(--color-text-secondary)]">
                  {getUploaderName(template.uploaded_by)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                  {t.columns.uploadedAt}
                </p>
                <p className="truncate text-[var(--color-text-secondary)]">
                  {formatDate(template.created_at, lang)}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                  {t.columns.type}
                </p>
                <p className="uppercase text-[var(--color-text-secondary)]">
                  {template.file_format}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                  {t.templates.size}
                </p>
                <p className="text-[var(--color-text-secondary)]">
                  {formatSize(template.file_size)}
                </p>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
