"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FileText, FileUp, FolderOpen, Trash2, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { formatLanFileSize } from "@/utils/lanFileTransfer";
import {
    dataTransferToSelectedFiles,
    fileListToSelectedFiles,
    type SelectedLanFile,
} from "@/utils/lanFileSelection";

interface LanFileDropZoneProps {
    files: SelectedLanFile[];
    onChange: (files: SelectedLanFile[]) => void;
}

export default function LanFileDropZone({
    files,
    onChange,
}: LanFileDropZoneProps) {
    const { t } = useTranslation();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const totalSize = useMemo(
        () => files.reduce((sum, item) => sum + item.file.size, 0),
        [files],
    );

    useEffect(() => {
        folderInputRef.current?.setAttribute("webkitdirectory", "");
        folderInputRef.current?.setAttribute("directory", "");
    }, []);

    const addFiles = (items: SelectedLanFile[]) => {
        if (items.length === 0) return;
        onChange([...files, ...items]);
    };

    const removeFile = (id: string) => {
        onChange(files.filter((item) => item.id !== id));
    };

    return (
        <div
            className={`flex min-h-44 flex-col gap-3 rounded-[var(--radius-md)] border p-3 transition ${isDragging
                ? "items-center justify-center border-dashed border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                : files.length === 0
                    ? "items-center justify-center border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] text-center"
                    : "border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]"
                }`}
            onClick={() => {
                if (files.length === 0) fileInputRef.current?.click();
            }}
            onDragOver={(event) => {
                event.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
                event.preventDefault();
                setIsDragging(false);
                void dataTransferToSelectedFiles(event.dataTransfer).then(addFiles);
            }}
        >
            <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                    addFiles(fileListToSelectedFiles(event.target.files));
                    event.currentTarget.value = "";
                }}
            />
            <input
                ref={folderInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => {
                    addFiles(fileListToSelectedFiles(event.target.files));
                    event.currentTarget.value = "";
                }}
            />

            {files.length === 0 ? (
                <div className="grid gap-2 text-center">
                    <FileUp size={28} className="mx-auto text-[var(--color-brand-primary)]" />
                    <p className="text-sm font-semibold text-[var(--color-text-secondary)]">
                        {t.lanTransfer.dropHint}
                    </p>
                    <div className="flex justify-center gap-2">
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                fileInputRef.current?.click();
                            }}
                            className="flex h-8 items-center gap-2 rounded-[var(--radius-sm)] bg-white px-3 text-xs font-bold text-[var(--color-text-secondary)] transition hover:text-[var(--color-brand-primary)]"
                        >
                            <FileUp size={14} />
                            {t.lanTransfer.chooseFiles}
                        </button>
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                folderInputRef.current?.click();
                            }}
                            className="flex h-8 items-center gap-2 rounded-[var(--radius-sm)] bg-white px-3 text-xs font-bold text-[var(--color-text-secondary)] transition hover:text-[var(--color-brand-primary)]"
                        >
                            <FolderOpen size={14} />
                            {t.lanTransfer.chooseFolder}
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex h-full min-h-0 flex-col gap-2">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-bold text-[var(--color-text-primary)]">
                            {files.length} {t.lanTransfer.files} - {formatLanFileSize(totalSize)}
                        </p>
                        <div className="flex shrink-0 gap-1">
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-subtle)]"
                                title={t.lanTransfer.chooseFiles}
                                aria-label={t.lanTransfer.chooseFiles}
                            >
                                <FileUp size={15} />
                            </button>
                            <button
                                type="button"
                                onClick={() => folderInputRef.current?.click()}
                                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-primary)] transition hover:bg-[var(--color-surface-subtle)]"
                                title={t.lanTransfer.chooseFolder}
                                aria-label={t.lanTransfer.chooseFolder}
                            >
                                <FolderOpen size={15} />
                            </button>
                            <button
                                type="button"
                                onClick={() => onChange([])}
                                className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)]"
                                title={t.lanTransfer.clearFiles}
                                aria-label={t.lanTransfer.clearFiles}
                            >
                                <Trash2 size={15} />
                            </button>
                        </div>
                    </div>
                    <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(100px,1fr))] gap-2 overflow-y-auto pr-1">
                        {files.map((item) => (
                            <div
                                key={item.id}
                                className="relative flex aspect-square flex-col items-center justify-center gap-1 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white p-2 text-center transition hover:border-[var(--color-brand-primary)]"
                            >
                                <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-surface-subtle)] text-[var(--color-brand-primary)]">
                                    <FileText size={18} />
                                </span>
                                <span
                                    className="w-full truncate text-xs font-bold text-[var(--color-text-primary)]"
                                    title={item.path}
                                >
                                    {item.path}
                                </span>
                                <span className="text-xxs text-[var(--color-text-muted)]">
                                    {formatLanFileSize(item.file.size)}
                                </span>
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        removeFile(item.id);
                                    }}
                                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-[var(--color-text-muted)] transition hover:text-[var(--color-accent-error)]"
                                    title={t.lanTransfer.removeFile}
                                    aria-label={t.lanTransfer.removeFile}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
