"use client";

import { Trash2, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { FileTemplate } from "@bduck/shared-types";
import type { Dictionary } from "@/lib/i18n";

interface FileTemplateDeleteModalProps {
    template: FileTemplate;
    t: Dictionary["fileLibrary"];
    onClose: () => void;
    onConfirm: () => Promise<unknown>;
}

export default function FileTemplateDeleteModal({
    template,
    t,
    onClose,
    onConfirm,
}: FileTemplateDeleteModalProps) {
    const submit = async () => {
        const action = async () => {
            await onConfirm();
            onClose();
        };

        await gooeyToast.promise(action(), {
            loading: t.templates.deleting,
            success: t.templates.deleteSuccess,
            error: t.templates.deleteError,
            description: {
                success: t.templates.deleteSuccessDesc,
                error: t.templates.deleteErrorDesc,
            },
        });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="grid w-[calc(100vw-32px)] gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 shadow-xl sm:w-[560px]">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]">
                            <Trash2 size={17} />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                                {t.templates.deleteTitle}
                            </h2>
                            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                                {t.templates.deleteHint}
                            </p>
                        </div>
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

                <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
                    <p className="truncate text-sm font-bold text-[var(--color-text-primary)]">
                        {template.title}
                    </p>
                    <p className="truncate text-xs text-[var(--color-text-muted)]">
                        {template.file_name}
                    </p>
                </div>

                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-3 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-subtle)]"
                    >
                        {t.templates.cancel}
                    </button>
                    <button
                        type="button"
                        onClick={() => void submit()}
                        className="h-9 rounded-[var(--radius-sm)] bg-[var(--color-error-text)] px-3 text-sm font-bold text-[var(--color-text-on-dark)] transition hover:brightness-95"
                    >
                        {t.templates.confirmDelete}
                    </button>
                </div>
            </div>
        </div>
    );
}
