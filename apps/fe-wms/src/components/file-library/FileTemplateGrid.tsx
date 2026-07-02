"use client";

import { useState } from "react";
import {
    Download,
    ExternalLink,
    History,
    Library,
    MoreVertical,
    Pencil,
    Trash2,
    UploadCloud,
} from "lucide-react";
import type { FileTemplate, FileTemplateCategory } from "@bduck/shared-types";
import type { Dictionary, Language } from "@/lib/i18n";
import { toFileLibraryDate } from "@/utils/fileLibrary";
import { FileLibraryFileIcon } from "./FileLibraryFileIcon";

interface FileTemplateGridProps {
    templates: FileTemplate[];
    t: Dictionary["fileLibrary"];
    lang: Language;
    getUploaderName: (userId: string) => string;
    canEdit: boolean;
    canDelete: boolean;
    onEdit: (template: FileTemplate) => void;
    onUploadVersion: (template: FileTemplate) => void;
    onShowHistory: (template: FileTemplate) => void;
    onDelete: (template: FileTemplate) => void;
}

const categoryTone: Record<FileTemplateCategory, string> = {
    finance: "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)]",
    admin: "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]",
    delivery: "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
    operations: "bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]",
    general: "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)]",
};

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

function getViewUrl(template: FileTemplate) {
    return template.file_format === "pdf"
        ? template.file_url
        : `https://docs.google.com/viewer?url=${encodeURIComponent(template.file_url)}`;
}

export default function FileTemplateGrid({
    templates,
    t,
    lang,
    getUploaderName,
    canEdit,
    canDelete,
    onEdit,
    onUploadVersion,
    onShowHistory,
    onDelete,
}: FileTemplateGridProps) {
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

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
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {templates.map((template) => {
                const category = template.category || "general";
                const canOpenMenu =
                    canEdit || canDelete || (template.version_history || []).length > 0;

                return (
                    <article
                        key={template.id}
                        className="relative flex flex-1 gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3"
                    >
                        <FileLibraryFileIcon
                            format={template.file_format}
                            extension={template.file_format}
                        />
                        <div className="flex min-w-0 flex-1 flex-col gap-3">
                            <div className="flex items-start gap-3">
                                <div className="min-w-0 flex-1">
                                    <div className="mb-2 flex flex-wrap items-center gap-1">
                                        <span
                                            className={`rounded-[var(--radius-sm)] px-2 py-0.5 text-xxs font-bold ${categoryTone[category]}`}
                                        >
                                            {t.templates.categories[category]}
                                        </span>
                                        <span className="rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] px-2 py-0.5 text-xxs font-bold text-[var(--color-text-secondary)]">
                                            v{template.version || 1}
                                        </span>
                                    </div>
                                    <h3 className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                                        {template.title}
                                    </h3>
                                    <p className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                                        {template.file_name}
                                    </p>
                                </div>
                                <div className="flex items-center gap-1">
                                    <a
                                        href={getViewUrl(template)}
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
                                    {canOpenMenu && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setOpenMenuId((current) =>
                                                    current === template.id ? null : template.id,
                                                )
                                            }
                                            className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text-secondary)]"
                                            aria-label={t.templates.moreActions}
                                            title={t.templates.moreActions}
                                        >
                                            <MoreVertical size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {openMenuId === template.id && (
                                <div className="absolute right-3 top-12 z-20 grid w-48 gap-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-1 shadow-lg">
                                    {canEdit && (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOpenMenuId(null);
                                                    onEdit(template);
                                                }}
                                                className="flex h-9 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)]"
                                            >
                                                <Pencil size={14} />
                                                {t.templates.editAction}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setOpenMenuId(null);
                                                    onUploadVersion(template);
                                                }}
                                                className="flex h-9 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)]"
                                            >
                                                <UploadCloud size={14} />
                                                {t.templates.updateVersionAction}
                                            </button>
                                        </>
                                    )}
                                    {(template.version_history || []).length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOpenMenuId(null);
                                                onShowHistory(template);
                                            }}
                                            className="flex h-9 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)]"
                                        >
                                            <History size={14} />
                                            {t.templates.historyAction}
                                        </button>
                                    )}
                                    {canDelete && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setOpenMenuId(null);
                                                onDelete(template);
                                            }}
                                            className="flex h-9 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-left text-sm font-semibold text-[var(--color-error-text)] transition hover:bg-[var(--color-error-bg)]"
                                        >
                                            <Trash2 size={14} />
                                            {t.templates.deleteAction}
                                        </button>
                                    )}
                                </div>
                            )}

                            {template.description && (
                                <p className="line-clamp-2 text-xs text-[var(--color-text-secondary)]">
                                    {template.description}
                                </p>
                            )}

                            <div className="grid grid-cols-2 gap-2 border-t border-[var(--color-border-soft)] pt-2 text-xs">
                                <div className="min-w-0">
                                    <p className="text-xxs font-semibold text-[var(--color-text-muted)]">
                                        {t.columns.uploader}
                                    </p>
                                    <p className="truncate text-[var(--color-text-secondary)]">
                                        {getUploaderName(template.uploaded_by)}
                                    </p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xxs font-semibold text-[var(--color-text-muted)]">
                                        {t.columns.uploadedAt}
                                    </p>
                                    <p className="truncate text-[var(--color-text-secondary)]">
                                        {formatDate(template.created_at, lang)}
                                    </p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xxs font-semibold text-[var(--color-text-muted)]">
                                        {t.columns.type}
                                    </p>
                                    <p className="text-[var(--color-text-secondary)]">
                                        .{template.file_format}
                                    </p>
                                </div>
                                <div className="min-w-0">
                                    <p className="text-xxs font-semibold text-[var(--color-text-muted)]">
                                        {t.templates.size}
                                    </p>
                                    <p className="text-[var(--color-text-secondary)]">
                                        {formatSize(template.file_size)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </article>
                );
            })}
        </div>
    );
}
