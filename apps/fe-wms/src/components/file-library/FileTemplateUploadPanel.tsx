"use client";

import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { ManagedFileFormat } from "@bduck/shared-types";
import type { Dictionary } from "@/lib/i18n";
import { uploadFile, validateFile, formatFileSize } from "@/lib/uploadFile";
import { useUserStore } from "@/stores/useUserStore";
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
        file_name: file.name,
        file_url: url,
        file_size: file.size,
        file_format: format as ManagedFileFormat,
      });
      setTitle("");
      setDescription("");
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
    <section className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3 lg:grid-cols-[1.2fr_1fr]">
      <div className="grid gap-3">
        <div className="grid gap-2 sm:grid-cols-2">
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
        </div>

        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
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
            className="flex min-h-16 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-subtle)] px-3 py-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-muted)] hover:text-[var(--color-brand-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UploadCloud size={18} />
            {file ? t.templates.changeFile : t.templates.chooseFile}
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => void submit()}
            className="h-9 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-4 text-sm font-bold text-[var(--color-text-on-dark)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t.templates.uploadButton}
          </button>
        </div>
      </div>

      <div className="flex min-h-24 items-center rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
        {file && format !== "other" ? (
          <div className="flex w-full items-center gap-3">
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
            {!isSubmitting && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-subtle)]"
                aria-label={t.templates.removeFile}
                title={t.templates.removeFile}
              >
                <X size={14} />
              </button>
            )}
          </div>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            {t.templates.supportHint}
          </p>
        )}
      </div>
    </section>
  );
}
