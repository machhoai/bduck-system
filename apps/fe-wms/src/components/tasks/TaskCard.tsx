"use client";

/**
 * TaskCard - Individual approval card in the Task Inbox
 *
 * All pending_approvals are approval tasks by definition.
 * LUAT THEP: i18n (vi + zh), light theme only.
 */

import { useMemo } from "react";
import {
    ArrowLeftRight,
    CheckCircle,
    ChevronRight,
    Clock,
    Hash,
    Layers,
    PackageMinus,
    PackagePlus,
    ShoppingCart,
    type LucideIcon,
} from "lucide-react";
import type { ApprovalRecord } from "@bduck/shared-types";
import type { Dictionary } from "@/lib/i18n";

interface TaskCardProps {
    approval: ApprovalRecord;
    onOpenDetail: (approval: ApprovalRecord) => void;
    t: Dictionary;
}

function getEntityMeta(entityType: string, t: Dictionary) {
    const map: Record<string, { label: string; badge: string; iconWrap: string; icon: LucideIcon }> = {
        IMPORT_VOUCHER: {
            label: t.tasks.entityType.IMPORT_VOUCHER,
            badge: "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]",
            iconWrap: "bg-[var(--color-success-bg)] text-[var(--color-success-text-strong)] ring-[var(--color-success-border)]",
            icon: PackagePlus,
        },
        EXPORT_VOUCHER: {
            label: t.tasks.entityType.EXPORT_VOUCHER,
            badge: "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
            iconWrap: "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)] ring-[var(--color-status-pending-border)]",
            icon: PackageMinus,
        },
        TRANSFER_ORDER: {
            label: t.tasks.entityType.TRANSFER_ORDER,
            badge: "border-[var(--color-status-intra-border)] bg-[var(--color-status-intra-bg)] text-[var(--color-status-intra-text)]",
            iconWrap: "bg-[var(--color-status-intra-bg)] text-[var(--color-status-intra-text)] ring-[var(--color-status-intra-border)]",
            icon: ArrowLeftRight,
        },
        PURCHASE_ORDER: {
            label: t.tasks.entityType.PURCHASE_ORDER,
            badge: "border-[var(--color-status-approved-border)] bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]",
            iconWrap: "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)] ring-[var(--color-status-approved-border)]",
            icon: ShoppingCart,
        },
    };

    return map[entityType] || {
        label: entityType,
        badge: "border-[var(--color-status-draft-border)] bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)]",
        iconWrap: "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)] ring-[var(--color-status-draft-border)]",
        icon: CheckCircle,
    };
}

function toDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;

    if (typeof value === "object" && value !== null) {
        const timestamp = value as {
            toDate?: () => Date;
            toMillis?: () => number;
            seconds?: number;
            _seconds?: number;
        };

        if (typeof timestamp.toDate === "function") {
            try {
                const date = timestamp.toDate();
                return Number.isNaN(date.getTime()) ? null : date;
            } catch {
                // Firestore Timestamp methods must be called with their original receiver.
            }
        }

        if (typeof timestamp.toMillis === "function") {
            try {
                const date = new Date(timestamp.toMillis());
                return Number.isNaN(date.getTime()) ? null : date;
            } catch {
                return null;
            }
        }

        if (typeof timestamp.seconds === "number") {
            return new Date(timestamp.seconds * 1000);
        }

        if (typeof timestamp._seconds === "number") {
            return new Date(timestamp._seconds * 1000);
        }
    }

    const date = new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? null : date;
}

export default function TaskCard({ approval, onOpenDetail, t }: TaskCardProps) {
    const meta = useMemo(() => getEntityMeta(approval.entity_type, t), [approval.entity_type, t]);

    const timeAgo = useMemo(() => {
        const createdAt = toDate(approval.created_at);
        if (!createdAt) return "";

        const diff = Math.max(0, Date.now() - createdAt.getTime());
        const minutes = Math.floor(diff / 60000);

        if (minutes < 1) return t.tasks.timeAgo.justNow;
        if (minutes < 60) return `${minutes}${t.tasks.timeAgo.minutes}`;

        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}${t.tasks.timeAgo.hours}`;

        const days = Math.floor(hours / 24);
        return `${days} ${t.tasks.timeAgo.days}`;
    }, [approval.created_at, t]);

    const Icon = meta.icon;
    const entityCode = approval.entity_id ? `${approval.entity_id.slice(0, 10)}...` : t.common.noData;

    return (
        <button
            type="button"
            onClick={() => onOpenDetail(approval)}
            className="group relative w-full rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-[var(--color-brand-primary-muted)] hover:shadow-md active:scale-[0.99]"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex h-8 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${meta.iconWrap}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xxs font-bold ${meta.badge}`}>
                            {meta.label}
                        </span>
                        <p className="mt-2 truncate text-base font-bold text-gray-950">
                            {entityCode}
                        </p>
                    </div>
                </div>

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-neutral-50)] text-[var(--color-neutral-300)] transition-colors group-hover:bg-[var(--color-brand-primary-muted)] group-hover:text-[var(--color-brand-primary)]">
                    <ChevronRight className="h-4 w-4" />
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-[var(--color-neutral-50)] px-3 py-2">
                    <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                        {t.tasks.card.level}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-bold text-[var(--color-text-primary)]">
                        <Layers className="h-3.5 w-3.5 text-[var(--color-brand-primary)]" />
                        {t.tasks.levelShort}{approval.level + 1}
                    </p>
                </div>
                <div className="rounded-lg bg-[var(--color-neutral-50)] px-3 py-2">
                    <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                        {t.tasks.card.status}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-bold text-[var(--color-status-pending-text)]">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {t.tasks.pendingLabel}
                    </p>
                </div>
                <div className="rounded-lg bg-[var(--color-neutral-50)] px-3 py-2">
                    <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                        {t.tasks.card.created}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-bold text-[var(--color-text-primary)]">
                        <Clock className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                        {timeAgo || t.common.noData}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--color-border-soft)] pt-3">
                <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-[var(--color-text-muted)]">
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{approval.id}</span>
                </div>
                <span className="shrink-0 text-xs font-bold text-[var(--color-brand-primary)]">
                    {t.tasks.tapToView}
                </span>
            </div>
        </button>
    );
}
