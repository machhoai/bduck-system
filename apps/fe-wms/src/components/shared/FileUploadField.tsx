"use client";

/**
 * FileUploadField — Reusable document upload component
 *
 * Hỗ trợ PDF, DOCX, XLSX, CSV (max 20MB).
 * Hỗ trợ cả CLICK để mở file picker VÀ DRAG-AND-DROP.
 * Hiển thị danh sách file đã chọn với icon theo loại, tên, dung lượng.
 * Cho phép xóa file khỏi danh sách trước khi submit.
 *
 * @see uploadFile.ts for validation logic
 */

import { FileText, FileSpreadsheet, X, Upload, FileUp } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import {
    validateFile,
    getFileTypeLabel,
    formatFileSize,
} from "../../lib/uploadFile";
import { useTranslation } from "@/lib/i18n";
import { FILE_UPLOAD_FIELD_TEXT } from "@/lib/i18n/componentTranslations";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface SelectedFile {
    id: string;
    file: File;
    name: string;
    size: number;
    type: string;
    /** Upload progress 0-100, null = not started */
    progress: number | null;
    /** Download URL after upload completes */
    url: string | null;
    /** Validation/upload error message */
    error: string | null;
}

interface FileUploadFieldProps {
    files: SelectedFile[];
    onFilesChange: (files: SelectedFile[]) => void;
    disabled?: boolean;
    maxFiles?: number;
    label: string;
    hint?: string;
}

// ─────────────────────────────────────────────
// FILE ICON
// ─────────────────────────────────────────────

function FileIcon({ mimeType }: { mimeType: string }) {
    const label = getFileTypeLabel(mimeType);

    if (label === "XLSX" || label === "CSV") {
        return (
            <FileSpreadsheet
                size={20}
                className="shrink-0 text-[var(--color-accent-success)]"
            />
        );
    }

    return (
        <FileText
            size={20}
            className="shrink-0 text-[var(--color-accent-info)]"
        />
    );
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

const ACCEPT =
    ".pdf,.docx,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

export function FileUploadField({
    files,
    onFilesChange,
    disabled = false,
    maxFiles = 5,
    label,
    hint,
}: FileUploadFieldProps) {
    const { lang } = useTranslation();
    const copy = FILE_UPLOAD_FIELD_TEXT[lang === "zh" ? "zh" : "vi"];
    const inputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);

    // ─── Process selected/dropped files ───
    const processFiles = useCallback(
        (fileList: FileList | File[]) => {
            const arr = Array.from(fileList);
            if (arr.length === 0) return;

            const newFiles: SelectedFile[] = [];

            for (const file of arr) {
                if (files.length + newFiles.length >= maxFiles) break;

                const validationErr = validateFile(file);

                newFiles.push({
                    id: crypto.randomUUID(),
                    file,
                    name: file.name,
                    size: file.size,
                    type: file.type,
                    progress: null,
                    url: null,
                    error: validationErr?.message.vi ?? null,
                });
            }

            if (newFiles.length > 0) {
                onFilesChange([...files, ...newFiles]);
            }
        },
        [files, maxFiles, onFilesChange],
    );

    // ─── Click to open file picker ───
    const handleClick = useCallback(() => {
        if (disabled) return;
        inputRef.current?.click();
    }, [disabled]);

    // ─── Native file input change ───
    const handleInputChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            const selected = event.target.files;
            if (selected && selected.length > 0) {
                processFiles(selected);
            }
            // Reset input so same file can be selected again
            event.target.value = "";
        },
        [processFiles],
    );

    // ─── Drag and drop ───
    const handleDragOver = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            if (!disabled) setIsDragging(true);
        },
        [disabled],
    );

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback(
        (e: React.DragEvent) => {
            e.preventDefault();
            e.stopPropagation();
            setIsDragging(false);
            if (disabled) return;

            const droppedFiles = e.dataTransfer.files;
            if (droppedFiles && droppedFiles.length > 0) {
                processFiles(droppedFiles);
            }
        },
        [disabled, processFiles],
    );

    // ─── Remove file ───
    const handleRemove = useCallback(
        (id: string) => {
            onFilesChange(files.filter((f) => f.id !== id));
        },
        [files, onFilesChange],
    );

    const canAddMore = files.length < maxFiles && !disabled;

    return (
        <div className="flex h-full flex-col gap-2 flex-1 justify-between">
            {/* Label */}
            <div className="flex flex-col gap-2">
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    {label}
                </p>
                {hint && (
                    <p className="text-xs text-[var(--color-text-muted)]">{hint}</p>
                )}
            </div>

            {/* Hidden file input */}
            <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                multiple
                disabled={disabled}
                className="hidden"
                onChange={handleInputChange}
            />

            {/* Dropzone / Upload button */}
            {canAddMore && (
                <div
                    role="button"
                    tabIndex={0}
                    onClick={handleClick}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleClick();
                        }
                    }}
                    onDragOver={handleDragOver}
                    onDragEnter={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`flex h-full flex-1 cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-sm)] border-2 border-dashed px-4 py-4 text-sm transition-all active:scale-[0.98] ${isDragging
                        ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]"
                        : "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] text-[var(--color-text-muted)] hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-muted)] hover:text-[var(--color-brand-primary)]"
                        } ${disabled ? "pointer-events-none opacity-50" : ""}`}
                >
                    {files.length === 0 ? (
                        <Upload size={24} className="opacity-60" />
                    ) : (
                        <FileUp size={20} className="opacity-60" />
                    )}
                    <span className="text-center">
                        {files.length === 0
                            ? copy.chooseOrDrop
                            : `${copy.addFile} (${files.length}/${maxFiles})`}
                    </span>
                    <span className="text-xxs opacity-60">
                        {copy.supportHint}
                    </span>
                </div>
            )}

            {/* File list */}
            {files.length > 0 && (
                <div className="flex flex-col gap-2">
                    {files.map((f) => (
                        <div
                            key={f.id}
                            className={`flex items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2.5 ${f.error
                                ? "border-[var(--color-accent-error)] bg-red-50"
                                : "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]"
                                }`}
                        >
                            <FileIcon mimeType={f.type} />

                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-normal text-[var(--color-text-primary)]">
                                    {f.name}
                                </p>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-[var(--color-text-muted)]">
                                        {formatFileSize(f.size)}
                                    </span>
                                    <span className="text-xs font-medium text-[var(--color-text-muted)]">
                                        {getFileTypeLabel(f.type)}
                                    </span>
                                    {f.progress !== null && f.progress < 100 && (
                                        <span className="text-xs text-[var(--color-accent-info)]">
                                            {f.progress}%
                                        </span>
                                    )}
                                    {f.error && (
                                        <span className="text-xs text-[var(--color-accent-error)]">
                                            {f.error}
                                        </span>
                                    )}
                                </div>

                                {/* Progress bar */}
                                {f.progress !== null && f.progress < 100 && (
                                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--color-border-subtle)]">
                                        <div
                                            className="h-full rounded-full bg-[var(--color-brand-primary)] transition-[width] duration-200"
                                            style={{ width: `${f.progress}%` }}
                                        />
                                    </div>
                                )}
                            </div>

                            {!disabled && (
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemove(f.id);
                                    }}
                                    className="shrink-0 rounded-full p-1 text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-border-subtle)] hover:text-[var(--color-accent-error)]"
                                    aria-label={copy.removeFile}
                                >
                                    <X size={16} />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
