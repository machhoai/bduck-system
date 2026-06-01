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
            badge: "border-emerald-200 bg-emerald-50 text-emerald-700",
            iconWrap: "bg-emerald-50 text-emerald-600 ring-emerald-100",
            icon: PackagePlus,
        },
        EXPORT_VOUCHER: {
            label: t.tasks.entityType.EXPORT_VOUCHER,
            badge: "border-amber-200 bg-amber-50 text-amber-700",
            iconWrap: "bg-amber-50 text-amber-600 ring-amber-100",
            icon: PackageMinus,
        },
        TRANSFER_ORDER: {
            label: t.tasks.entityType.TRANSFER_ORDER,
            badge: "border-violet-200 bg-violet-50 text-violet-700",
            iconWrap: "bg-violet-50 text-violet-600 ring-violet-100",
            icon: ArrowLeftRight,
        },
        PURCHASE_ORDER: {
            label: t.tasks.entityType.PURCHASE_ORDER,
            badge: "border-blue-200 bg-blue-50 text-blue-700",
            iconWrap: "bg-blue-50 text-blue-600 ring-blue-100",
            icon: ShoppingCart,
        },
    };

    return map[entityType] || {
        label: entityType,
        badge: "border-gray-200 bg-gray-50 text-gray-600",
        iconWrap: "bg-gray-50 text-gray-500 ring-gray-100",
        icon: CheckCircle,
    };
}

function toDate(value: unknown): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value === "object" && value !== null && "toDate" in value) {
        const toDateFn = (value as { toDate?: () => Date }).toDate;
        if (typeof toDateFn === "function") return toDateFn();
    }
    if (typeof value === "object" && value !== null && "seconds" in value) {
        return new Date((value as { seconds: number }).seconds * 1000);
    }
    const date = new Date(value as string);
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
            className="group relative w-full rounded-lg border border-gray-100 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-md active:scale-[0.99]"
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ring-1 ${meta.iconWrap}`}>
                        <Icon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${meta.badge}`}>
                            {meta.label}
                        </span>
                        <p className="mt-2 truncate text-base font-bold text-gray-950">
                            {entityCode}
                        </p>
                    </div>
                </div>

                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-300 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600">
                    <ChevronRight className="h-4 w-4" />
                </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-gray-400">
                        {t.tasks.card.level}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-bold text-gray-900">
                        <Layers className="h-3.5 w-3.5 text-blue-500" />
                        {t.tasks.levelShort}{approval.level + 1}
                    </p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-gray-400">
                        {t.tasks.card.status}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-bold text-amber-700">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {t.tasks.pendingLabel}
                    </p>
                </div>
                <div className="rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-[10px] font-semibold uppercase text-gray-400">
                        {t.tasks.card.created}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-sm font-bold text-gray-900">
                        <Clock className="h-3.5 w-3.5 text-gray-400" />
                        {timeAgo || t.common.noData}
                    </p>
                </div>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
                <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-gray-500">
                    <Hash className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{approval.id}</span>
                </div>
                <span className="shrink-0 text-xs font-bold text-blue-600">
                    {t.tasks.tapToView}
                </span>
            </div>
        </button>
    );
}
