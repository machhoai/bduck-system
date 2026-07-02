"use client";

import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { FileTemplateCategory, ManagedFileFormat } from "@bduck/shared-types";
import type { Dictionary } from "@/lib/i18n";
import { uploadFile, validateFile, formatFileSize } from "@/lib/uploadFile";
import { useUserStore } from "@/stores/useUserStore";
import { FILE_TEMPLATE_CATEGORY_OPTIONS } from "@/utils/fileTemplateCategories";
import {
    getFileExtension,
    getFileFormat,
} from "@/utils/fileLibrary";
import type { CreateFileTemplatePayload } from "@/hooks/useFileTemplates";
import { FileLibraryFileIcon } from "./FileLibraryFileIcon";

interface FileTemplateUploadPanelProps {
    t: Dictionary["fileLibrary"];
    onCreate: (payload: CreateFileTemplatePayload) => Promise<unknown>;
}

const ACCEPT =
    ".pdf,.docx,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

export default function FileTemplateUploadPanel({
    t,
    onCreate,
}: FileTemplateUploadPanelProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const userId = useUserStore((state) => state.user?.id);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [category, setCategory] = useState<FileTemplateCategory>("general");
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const extension = file ? getFileExtension(file.name) : "";
    const format = getFileFormat(extension);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!isSubmitting) setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (isSubmitting) return;
        const droppedFile = e.dataTransfer.files?.[0];
        if (droppedFile) {
            handleFile(droppedFile);
        }
    };

    const handleFile = (nextFile: File | undefined) => {
        if (!nextFile) return;
        const error = validateFile(nextFile);
        if (error) {
            gooeyToast.error(t.templates.invalidFile, {
                description: error.message.vi,
                preset: "snappy",
            });
            return;
        }
        setFile(nextFile);
        if (!title.trim()) {
            setTitle(nextFile.name.replace(/\.[^.]+$/, ""));
        }
    };

    const submit = async () => {
        if (!title.trim() || !file || format === "other") {
            gooeyToast.error(t.templates.missingInfo, {
                description: t.templates.missingInfoDesc,
                preset: "snappy",
            });
            return;
        }

        const action = async () => {
            setIsSubmitting(true);
            setProgress(0);
            const url = await uploadFile(
                file,
                `file-templates/${userId || "unknown"}`,
                setProgress,
            );
            await onCreate({
                title: title.trim(),
                description: description.trim() || null,
                category,
                file_name: file.name,
                file_url: url,
                file_size: file.size,
                file_format: format as ManagedFileFormat,
            });
            setTitle("");
            setDescription("");
            setCategory("general");
            setFile(null);
            setProgress(0);
        };

        try {
            await gooeyToast.promise(action(), {
                loading: t.templates.uploading,
                success: t.templates.uploadSuccess,
                error: t.templates.uploadError,
                description: {
                    success: t.templates.uploadSuccessDesc,
                    error: t.templates.uploadErrorDesc,
                },
                action: {
                    error: {
                        label: t.templates.retry,
                        onClick: () => void submit(),
                    },
                },
            });
        } catch (error) {
            console.error("[FileTemplateUploadPanel] upload error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <section className="grid gap-3 rounded-[var(--radius-md)] grid-cols-2 border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
            <div className="grid gap-2 sm:grid-cols-1">
                <label className="grid gap-1">
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                        {t.templates.titleLabel}
                    </span>
                    <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        disabled={isSubmitting}
                        className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
                        placeholder={t.templates.titlePlaceholder}
                    />
                </label>
                <label className="grid gap-1">
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                        {t.templates.descriptionLabel}
                    </span>
                    <input
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        disabled={isSubmitting}
                        className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
                        placeholder={t.templates.descriptionPlaceholder}
                    />
                </label>
                <label className="grid gap-1">
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                        {t.templates.categoryLabel}
                    </span>
                    <select
                        value={category}
                        onChange={(event) =>
                            setCategory(event.target.value as FileTemplateCategory)
                        }
                        disabled={isSubmitting}
                        className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
                    >
                        {FILE_TEMPLATE_CATEGORY_OPTIONS.map((item) => (
                            <option key={item} value={item}>
                                {t.templates.categories[item]}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                <div
                    className="relative w-full h-full"
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                >
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPT}
                        className="hidden"
                        disabled={isSubmitting}
                        onChange={(event) => handleFile(event.target.files?.[0])}
                    />

                    {file && format !== "other" ? (
                        <div className={`flex w-full h-full items-center justify-between rounded-[var(--radius-sm)] border bg-[var(--color-surface-card)] px-3 py-2 transition ${isDragging ? "border-[var(--color-brand-primary)]" : "border-[var(--color-border-subtle)]"}`}>
                            <div className="flex min-w-0 flex-1 h-full items-center gap-3">
                                <FileLibraryFileIcon format={format} extension={extension} />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                        {file.name}
                                    </p>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        {formatFileSize(file.size)}
                                    </p>
                                    {isSubmitting && (
                                        <progress
                                            className="mt-2 h-1 w-full"
                                            value={progress}
                                            max={100}
                                        />
                                    )}
                                </div>
                            </div>
                            <div className="ml-3 h-full flex shrink-0 items-center gap-1">
                                {!isSubmitting && (
                                    <>
                                        <button
                                            type="button"
                                            onClick={() => inputRef.current?.click()}
                                            className="flex h-full items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)]"
                                        >
                                            <UploadCloud size={14} />
                                            {t.templates.changeFile}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setFile(null)}
                                            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)]"
                                            aria-label={t.templates.removeFile}
                                            title={t.templates.removeFile}
                                        >
                                            <X size={14} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <button
                            type="button"
                            disabled={isSubmitting}
                            onClick={() => inputRef.current?.click()}
                            className={`flex h-full w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${isDragging ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]" : "border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] text-[var(--color-text-secondary)] hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-muted)] hover:text-[var(--color-brand-primary)]"}`}
                        >
                            <UploadCloud size={18} />
                            {isDragging ? t.templates.dropFileHere : t.templates.chooseFile}
                        </button>
                    )}

                    {isDragging && file && format !== "other" && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)] bg-opacity-90">
                            <span className="text-sm font-bold text-[var(--color-brand-primary)] flex items-center gap-2">
                                <UploadCloud size={18} />
                                {t.templates.dropFileHere}
                            </span>
                        </div>
                    )}
                </div>

                <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void submit()}
                    className="h-full rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-4 text-sm font-bold text-[var(--color-text-on-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {t.templates.uploadButton}
                </button>
            </div>
        </section>
    );
}
