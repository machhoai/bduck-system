"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import type { ReactNode } from "react";

export interface DetailField {
    label: string;
    value: string;
}

export function InfoPill({ label, value }: DetailField) {
    return (
        <div className="min-w-0 rounded-2xl bg-[var(--color-surface-card)] px-3 py-2">
            <p className="truncate text-[10px] font-medium text-[var(--color-text-muted)] tracking-wider">
                {label}
            </p>
            <p className="mt-1 truncate text-sm font-normal text-[var(--color-text-primary)]">
                {value}
            </p>
        </div>
    );
}

export function DetailGrid({ fields }: { fields: DetailField[] }) {
    return (
        <div className="grid gap-2 sm:grid-cols-2">
            {fields.map((field) => (
                <InfoPill
                    key={field.label}
                    label={field.label}
                    value={field.value}
                />
            ))}
        </div>
    );
}

export function MetricTile({
    label,
    value,
    tone = "default",
    actionLabel,
    onClick,
}: {
    label: string;
    value: string;
    tone?: "default" | "success" | "warning";
    actionLabel?: string;
    onClick?: () => void;
}) {
    const toneClass =
        tone === "success"
            ? "text-[#257a3e]"
            : tone === "warning"
              ? "text-[#936000]"
              : "text-[var(--color-text-primary)]";

    const content = (
        <>
            <p className={`text-2xl font-semibold tabular-nums ${toneClass}`}>
                {value}
            </p>
            <p className="mt-1 text-[10px] font-medium uppercase text-[var(--color-text-muted)] tracking-wider">
                {label}
            </p>
        </>
    );

    return onClick ? (
        <button
            aria-label={actionLabel || label}
            className="relative rounded-2xl bg-[var(--color-surface-card)] p-3 text-center transition-all hover:bg-[var(--color-brand-primary-muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] active:scale-[0.98]"
            onClick={onClick}
            title={actionLabel}
            type="button"
        >
            <ArrowUpRight
                aria-hidden="true"
                className="absolute right-2 top-2 text-[var(--color-text-muted)]"
                size={12}
            />
            {content}
        </button>
    ) : (
        <div className="rounded-2xl bg-[var(--color-surface-card)] p-3 text-center">
            {content}
        </div>
    );
}

export function ActionButton({
    icon,
    label,
    onClick,
}: {
    icon: ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-[var(--color-border-soft)] bg-white px-3 text-sm font-semibold text-[var(--color-text-primary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-[0.98] lg:hidden"
        >
            {icon}
            <span className="truncate">{label}</span>
        </button>
    );
}

export function ExpandablePanel({
    open,
    label,
    children,
    onToggle,
}: {
    open: boolean;
    label: string;
    children: ReactNode;
    onToggle: () => void;
}) {
    return (
        <div className="mt-4 hidden lg:block">
            <button
                type="button"
                onClick={onToggle}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--color-border-soft)] px-4 text-sm font-semibold text-[var(--color-text-primary)] transition-all hover:bg-[var(--color-surface-card)]"
            >
                <ChevronDown
                    size={16}
                    className={`transition-transform ${open ? "rotate-180" : ""}`}
                />
                <span>{label}</span>
            </button>
            {open ? <div className="mt-3">{children}</div> : null}
        </div>
    );
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-4 text-center">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {title}
            </p>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {hint}
            </p>
        </div>
    );
}
