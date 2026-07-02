"use client";

import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { FileTemplate, ManagedFileFormat } from "@bduck/shared-types";
import type { UploadNewTemplateVersionPayload } from "@/hooks/useFileTemplates";
import type { Dictionary } from "@/lib/i18n";
import { formatFileSize, uploadFile, validateFile } from "@/lib/uploadFile";
import { useUserStore } from "@/stores/useUserStore";
import { getFileExtension, getFileFormat } from "@/utils/fileLibrary";
import { FileLibraryFileIcon } from "./FileLibraryFileIcon";

interface FileTemplateVersionModalProps {
    template: FileTemplate;
    t: Dictionary["fileLibrary"];
    onClose: () => void;
    onUpload: (payload: UploadNewTemplateVersionPayload) => Promise<unknown>;
}

const ACCEPT =
    ".pdf,.docx,.xlsx,.csv,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

export default function FileTemplateVersionModal({
    template,
    t,
    onClose,
    onUpload,
}: FileTemplateVersionModalProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const userId = useUserStore((state) => state.user?.id);
    const [file, setFile] = useState<File | null>(null);
    const [progress, setProgress] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const extension = file ? getFileExtension(file.name) : "";
    const format = getFileFormat(extension);

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
    };

    const submit = async () => {
        if (!file || format === "other") {
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
                `file-templates/${userId || "unknown"}/versions/${template.id}`,
                setProgress,
            );
            await onUpload({
                file_name: file.name,
                file_url: url,
                file_size: file.size,
                file_format: format as ManagedFileFormat,
            });
            onClose();
        };

        try {
            await gooeyToast.promise(action(), {
                loading: t.templates.uploadingVersion,
                success: t.templates.versionSuccess,
                error: t.templates.versionError,
                description: {
                    success: t.templates.versionSuccessDesc,
                    error: t.templates.versionErrorDesc,
                },
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="grid w-[calc(100vw-32px)] gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 shadow-xl sm:w-[640px]">
                <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-[var(--color-text-primary)]">
                            {t.templates.versionTitle}
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

                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT}
                    className="hidden"
                    disabled={isSubmitting}
                    onChange={(event) => handleFile(event.target.files?.[0])}
                />

                <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => inputRef.current?.click()}
                    className="grid min-h-28 place-items-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] p-4 text-center transition hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-muted)] disabled:opacity-60"
                >
                    {file && format !== "other" ? (
                        <span className="flex w-full items-center justify-center gap-3">
                            <FileLibraryFileIcon format={format} extension={extension} />
                            <span className="min-w-0 text-left">
                                <span className="block truncate text-sm font-bold text-[var(--color-text-primary)]">
                                    {file.name}
                                </span>
                                <span className="block text-xs text-[var(--color-text-muted)]">
                                    {formatFileSize(file.size)}
                                </span>
                            </span>
                        </span>
                    ) : (
                        <span className="grid gap-2 text-sm font-semibold text-[var(--color-text-secondary)]">
                            <UploadCloud size={22} className="mx-auto" />
                            {t.templates.versionHint}
                        </span>
                    )}
                </button>

                {isSubmitting && (
                    <progress className="h-1 w-full" value={progress} max={100} />
                )}

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)] disabled:opacity-60"
                    >
                        {t.templates.cancel}
                    </button>
                    <button
                        type="button"
                        onClick={() => void submit()}
                        disabled={isSubmitting}
                        className="h-9 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-3 text-sm font-bold text-[var(--color-text-on-dark)] transition hover:brightness-95 disabled:opacity-60"
                    >
                        {t.templates.uploadVersionButton}
                    </button>
                </div>
            </div>
        </div>
    );
}
