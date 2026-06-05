"use client";

import Link from "next/link";
import { ArrowRightLeft, Download, ExternalLink, PackageMinus, PackagePlus } from "lucide-react";
import type { Dictionary, Language } from "@/lib/i18n";
import type {
  FileLibraryItem,
  FileLibrarySourceType,
} from "@/utils/fileLibrary";
import { FileLibraryFileIcon } from "./FileLibraryFileIcon";

interface FileLibraryTableProps {
  files: FileLibraryItem[];
  t: Dictionary["fileLibrary"];
  lang: Language;
}

const sourceIconMap = {
  IMPORT_VOUCHER: PackagePlus,
  EXPORT_VOUCHER: PackageMinus,
  TRANSFER_ORDER: ArrowRightLeft,
};

const sourceClassMap: Record<FileLibrarySourceType, string> = {
  IMPORT_VOUCHER:
    "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]",
  EXPORT_VOUCHER:
    "bg-[var(--color-status-export-bg)] text-[var(--color-status-export-text)]",
  TRANSFER_ORDER:
    "bg-[var(--color-status-intra-bg)] text-[var(--color-status-intra-text)]",
};

function formatDate(date: Date | null, lang: Language) {
  if (!date) return "-";
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function SourceBadge({
  sourceType,
  label,
}: {
  sourceType: FileLibrarySourceType;
  label: string;
}) {
  const Icon = sourceIconMap[sourceType];

  return (
    <span
      className={`inline-flex h-6 w-fit items-center gap-1 rounded-[var(--radius-sm)] px-2 text-xxs font-bold ${sourceClassMap[sourceType]}`}
    >
      <Icon size={12} />
      {label}
    </span>
  );
}

function FileActions({
  file,
  t,
}: {
  file: FileLibraryItem;
  t: Dictionary["fileLibrary"];
}) {
  return (
    <div className="flex items-center justify-end gap-1">
      <a
        href={file.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-primary-muted)]"
        title={t.openFile}
        aria-label={t.openFile}
      >
        <ExternalLink size={14} />
      </a>
      <a
        href={file.url}
        download={file.fileName}
        target="_blank"
        rel="noopener noreferrer"
        className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-secondary)]"
        title={t.download}
        aria-label={t.download}
      >
        <Download size={14} />
      </a>
    </div>
  );
}

function MobileFileCard({
  file,
  t,
  lang,
}: {
  file: FileLibraryItem;
  t: Dictionary["fileLibrary"];
  lang: Language;
}) {
  return (
    <article className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
      <div className="flex items-start gap-3">
        <FileLibraryFileIcon format={file.format} extension={file.extension} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            {file.fileName}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <SourceBadge
              sourceType={file.sourceType}
              label={t.sources[file.sourceType]}
            />
            <span className="text-xxs text-[var(--color-text-muted)]">
              {file.sourceNumber}
            </span>
          </div>
        </div>
        <FileActions file={file} t={t} />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
            {t.columns.uploader}
          </p>
          <p className="truncate text-[var(--color-text-secondary)]">
            {file.uploaderName}
          </p>
        </div>
        <div>
          <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
            {t.columns.uploadedAt}
          </p>
          <p className="truncate text-[var(--color-text-secondary)]">
            {formatDate(file.uploadedAt, lang)}
          </p>
        </div>
      </div>

      <p className="mt-2 line-clamp-2 text-xs text-[var(--color-text-muted)]">
        {t.purposes[file.purposeKey]}
      </p>
    </article>
  );
}

export default function FileLibraryTable({
  files,
  t,
  lang,
}: FileLibraryTableProps) {
  if (files.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 text-center">
        <p className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t.emptyTitle}
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          {t.emptyHint}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] lg:block">
        <table className="w-full table-fixed border-collapse">
          <thead className="bg-[var(--color-surface-subtle)]">
            <tr className="text-left text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
              <th className="w-72 px-2 py-2">{t.columns.fileName}</th>
              <th className="w-20 px-2 py-2">{t.columns.type}</th>
              <th className="w-36 px-2 py-2">{t.columns.uploader}</th>
              <th className="w-36 px-2 py-2">{t.columns.uploadedAt}</th>
              <th className="px-2 py-2">{t.columns.purpose}</th>
              <th className="w-40 px-2 py-2">{t.columns.source}</th>
              <th className="w-20 px-2 py-2 text-right">{t.columns.actions}</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <tr
                key={file.id}
                className="border-t border-[var(--color-border-soft)] text-sm transition hover:bg-[var(--color-surface-card)]"
              >
                <td className="px-2 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <FileLibraryFileIcon
                      format={file.format}
                      extension={file.extension}
                    />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-[var(--color-text-primary)]">
                        {file.fileName}
                      </p>
                      <p className="truncate text-xxs text-[var(--color-text-muted)]">
                        {file.url}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-2 py-2">
                  <span className="rounded-[var(--radius-xs)] bg-[var(--color-surface-subtle)] px-1.5 py-1 text-xxs font-bold uppercase text-[var(--color-text-secondary)]">
                    {file.extension || file.format}
                  </span>
                </td>
                <td className="truncate px-2 py-2 text-[var(--color-text-secondary)]">
                  {file.uploaderName}
                </td>
                <td className="truncate px-2 py-2 text-[var(--color-text-muted)]">
                  {formatDate(file.uploadedAt, lang)}
                </td>
                <td className="px-2 py-2 text-[var(--color-text-secondary)]">
                  <p className="line-clamp-2">{t.purposes[file.purposeKey]}</p>
                </td>
                <td className="px-2 py-2">
                  <div className="flex min-w-0 flex-col gap-1">
                    <SourceBadge
                      sourceType={file.sourceType}
                      label={t.sources[file.sourceType]}
                    />
                    <Link
                      href={file.sourceHref}
                      className="truncate text-xxs font-semibold text-[var(--color-brand-primary)] hover:underline"
                    >
                      {file.sourceNumber}
                    </Link>
                  </div>
                </td>
                <td className="px-2 py-2">
                  <FileActions file={file} t={t} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid gap-2 lg:hidden">
        {files.map((file) => (
          <MobileFileCard key={file.id} file={file} t={t} lang={lang} />
        ))}
      </div>
    </>
  );
}
