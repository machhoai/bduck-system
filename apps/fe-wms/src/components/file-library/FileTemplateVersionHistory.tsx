"use client";

import { Download, ExternalLink, History, X } from "lucide-react";
import type { FileTemplate, FileTemplateVersionEntry } from "@bduck/shared-types";
import type { Dictionary, Language } from "@/lib/i18n";
import { toFileLibraryDate } from "@/utils/fileLibrary";
import { FileLibraryFileIcon } from "./FileLibraryFileIcon";

interface FileTemplateVersionHistoryProps {
    template: FileTemplate;
    t: Dictionary["fileLibrary"];
    lang: Language;
    getUploaderName: (userId: string) => string;
    onClose: () => void;
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

function getViewUrl(entry: FileTemplateVersionEntry) {
    return entry.file_format === "pdf"
        ? entry.file_url
        : `https://docs.google.com/viewer?url=${encodeURIComponent(entry.file_url)}`;
}

export default function FileTemplateVersionHistory({
    template,
    t,
    lang,
    getUploaderName,
    onClose,
}: FileTemplateVersionHistoryProps) {
    const historyRows = [...(template.version_history || [])].sort(
        (a, b) => b.version - a.version,
    );

    return (
        <div className="fixed inset-0 z-50 bg-black/30">
            <aside className="ml-auto grid h-full w-full grid-rows-[auto_1fr] gap-3 border-l border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 shadow-xl sm:w-[560px]">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-[var(--color-text-primary)]">
                            {t.templates.historyTitle}
                        </h2>
                        <p className="truncate text-xs text-[var(--color-text-muted)]">
                            {template.title}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)]"
                        aria-label={t.close}
                        title={t.close}
                    >
                        <X size={16} />
                    </button>
                </div>

                <div className="overflow-y-auto">
                    <div className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
                        <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                                    {t.templates.currentVersion}
                                </p>
                                <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                                    v{template.version || 1} - {template.file_name}
                                </p>
                            </div>
                            <div className="flex items-center gap-1">
                                <a
                                    href={
                                        template.file_format === "pdf"
                                            ? template.file_url
                                            : `https://docs.google.com/viewer?url=${encodeURIComponent(template.file_url)}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-primary-muted)]"
                                    title={t.openFile}
                                    aria-label={t.openFile}
                                >
                                    <ExternalLink size={15} />
                                </a>
                                <a
                                    href={template.file_url}
                                    download={template.file_name}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)]"
                                    title={t.download}
                                    aria-label={t.download}
                                >
                                    <Download size={15} />
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                        {historyRows.length === 0 ? (
                            <div className="grid min-h-40 place-items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-subtle)] p-4 text-center">
                                <History size={24} className="text-[var(--color-text-muted)]" />
                                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                    {t.templates.noHistory}
                                </p>
                            </div>
                        ) : (
                            historyRows.map((entry) => (
                                <article
                                    key={`${entry.version}-${entry.file_url}`}
                                    className="grid gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex min-w-0 items-start gap-3">
                                            <FileLibraryFileIcon
                                                format={entry.file_format}
                                                extension={entry.file_format}
                                            />
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                                                    v{entry.version} - {entry.file_name}
                                                </p>
                                                <p className="text-xs text-[var(--color-text-muted)]">
                                                    {formatSize(entry.file_size)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <a
                                                href={getViewUrl(entry)}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-brand-primary)] transition hover:bg-[var(--color-brand-primary-muted)]"
                                                title={t.openFile}
                                                aria-label={t.openFile}
                                            >
                                                <ExternalLink size={15} />
                                            </a>
                                            <a
                                                href={entry.file_url}
                                                download={entry.file_name}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)]"
                                                title={t.download}
                                                aria-label={t.download}
                                            >
                                                <Download size={15} />
                                            </a>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="min-w-0">
                                            <p className="text-xxs font-semibold text-[var(--color-text-muted)]">
                                                {t.columns.uploader}
                                            </p>
                                            <p className="truncate text-[var(--color-text-secondary)]">
                                                {getUploaderName(entry.uploaded_by)}
                                            </p>
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xxs font-semibold text-[var(--color-text-muted)]">
                                                {t.columns.uploadedAt}
                                            </p>
                                            <p className="truncate text-[var(--color-text-secondary)]">
                                                {formatDate(entry.uploaded_at, lang)}
                                            </p>
                                        </div>
                                    </div>
                                </article>
                            ))
                        )}
                    </div>
                </div>
            </aside>
        </div>
    );
}
