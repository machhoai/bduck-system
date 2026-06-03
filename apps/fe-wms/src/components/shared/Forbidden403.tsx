"use client";

/**
 * Forbidden403 — Access denied page
 *
 * Shown when a user navigates to a page they don't have permission to access.
 * LUẬT THÉP: i18n (vi + zh), Light Theme only.
 */

import { ShieldAlert, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/lib/i18n";

export default function Forbidden403() {
    const router = useRouter();
    const { t } = useTranslation();

    return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
            {/* Icon */}
            <div className="mb-4 flex h-8 w-12 items-center justify-center rounded-2xl bg-[var(--color-error-bg)]">
                <ShieldAlert className="h-6 w-6 text-[var(--color-error-icon)]" strokeWidth={1.5} />
            </div>

            {/* Title */}
            <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
                {t.forbidden.title}
            </h1>

            {/* Description */}
            <p className="mt-2 w-full text-sm text-[var(--color-text-muted)]">
                {t.forbidden.description}
            </p>

            {/* Actions */}
            <div className="mt-4 flex items-center gap-3">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="flex h-8 w-fit items-center gap-2 rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-3 text-sm font-medium text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-neutral-50)] active:bg-[var(--color-neutral-100)]"
                >
                    <ArrowLeft className="h-4 w-4" />
                    {t.forbidden.goBack}
                </button>
                <button
                    type="button"
                    onClick={() => router.push("/dashboard")}
                    className="h-8 w-fit rounded-xl bg-[var(--color-brand-primary)] px-3 text-sm font-medium text-[var(--color-text-on-dark)] transition-colors hover:bg-[var(--color-brand-primary-hover)] active:bg-[var(--color-brand-primary-hover)]"
                >
                    {t.forbidden.goHome}
                </button>
            </div>
        </div>
    );
}
