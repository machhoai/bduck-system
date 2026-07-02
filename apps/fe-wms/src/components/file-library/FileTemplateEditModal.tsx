"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { FileTemplate, FileTemplateCategory } from "@bduck/shared-types";
import type { UpdateFileTemplatePayload } from "@/hooks/useFileTemplates";
import type { Dictionary } from "@/lib/i18n";
import { FILE_TEMPLATE_CATEGORY_OPTIONS } from "@/utils/fileTemplateCategories";

interface FileTemplateEditModalProps {
    template: FileTemplate;
    t: Dictionary["fileLibrary"];
    onClose: () => void;
    onSave: (payload: UpdateFileTemplatePayload) => Promise<unknown>;
}

export default function FileTemplateEditModal({
    template,
    t,
    onClose,
    onSave,
}: FileTemplateEditModalProps) {
    const [title, setTitle] = useState(template.title);
    const [description, setDescription] = useState(template.description || "");
    const [category, setCategory] = useState<FileTemplateCategory>(
        template.category || "general",
    );
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submit = async () => {
        if (!title.trim()) {
            gooeyToast.error(t.templates.missingInfo, {
                description: t.templates.missingInfoDesc,
                preset: "snappy",
            });
            return;
        }

        const action = async () => {
            setIsSubmitting(true);
            await onSave({
                title: title.trim(),
                description: description.trim() || null,
                category,
            });
            onClose();
        };

        try {
            await gooeyToast.promise(action(), {
                loading: t.templates.savingChanges,
                success: t.templates.editSuccess,
                error: t.templates.editError,
                description: {
                    success: t.templates.editSuccessDesc,
                    error: t.templates.editErrorDesc,
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
                    <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                        {t.templates.editTitle}
                    </h2>
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

                <label className="grid gap-1">
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                        {t.templates.titleLabel}
                    </span>
                    <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        disabled={isSubmitting}
                        className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
                    />
                </label>

                <label className="grid gap-1">
                    <span className="text-xs font-semibold text-[var(--color-text-muted)]">
                        {t.templates.descriptionLabel}
                    </span>
                    <textarea
                        value={description}
                        onChange={(event) => setDescription(event.target.value)}
                        disabled={isSubmitting}
                        rows={3}
                        className="resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-2 text-sm text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)]"
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
                        {t.templates.saveChanges}
                    </button>
                </div>
            </div>
        </div>
    );
}
