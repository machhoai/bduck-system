"use client";

/**
 * TaskCard — Individual approval card in the Task Inbox
 *
 * SIMPLIFIED: No more WorkflowNodeType branching.
 * All pending_approvals are APPROVAL type by definition.
 *
 * LUẬT THÉP: i18n (vi + zh), light theme only
 */

import { useMemo } from "react";
import {
    CheckCircle,
    Clock,
    ChevronRight,
    Layers,
} from "lucide-react";
import type { ApprovalRecord } from "@bduck/shared-types";
import type { Dictionary } from "@/lib/i18n";

interface TaskCardProps {
    approval: ApprovalRecord;
    onOpenDetail: (approval: ApprovalRecord) => void;
    t: Dictionary;
}

/** Map entity_type to label + color */
function getEntityMeta(entityType: string, t: Dictionary) {
    const map: Record<string, { label: string; color: string; bgIcon: string }> = {
        IMPORT_VOUCHER: {
            label: t.tasks.entityType?.IMPORT_VOUCHER || "Phiếu nhập",
            color: "border-amber-200 bg-amber-50 text-amber-700",
            bgIcon: "bg-amber-100 text-amber-600",
        },
        EXPORT_VOUCHER: {
            label: t.tasks.entityType?.EXPORT_VOUCHER || "Phiếu xuất",
            color: "border-blue-200 bg-blue-50 text-blue-700",
            bgIcon: "bg-blue-100 text-blue-600",
        },
        TRANSFER_ORDER: {
            label: t.tasks.entityType?.TRANSFER_ORDER || "Lệnh chuyển kho",
            color: "border-purple-200 bg-purple-50 text-purple-700",
            bgIcon: "bg-purple-100 text-purple-600",
        },
        PURCHASE_ORDER: {
            label: t.tasks.entityType?.PURCHASE_ORDER || "Đơn mua hàng",
            color: "border-emerald-200 bg-emerald-50 text-emerald-700",
            bgIcon: "bg-emerald-100 text-emerald-600",
        },
    };

    return map[entityType] || {
        label: entityType,
        color: "border-gray-200 bg-gray-50 text-gray-600",
        bgIcon: "bg-gray-100 text-gray-500",
    };
}

export default function TaskCard({ approval, onOpenDetail, t }: TaskCardProps) {
    const meta = useMemo(() => getEntityMeta(approval.entity_type, t), [approval.entity_type, t]);

    const timeAgo = useMemo(() => {
        if (!approval.created_at) return "";
        const d = approval.created_at instanceof Date
            ? approval.created_at
            : new Date(approval.created_at as unknown as string);
        const diff = Date.now() - d.getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 60) return `${minutes}${t.tasks.timeAgo.minutes}`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}${t.tasks.timeAgo.hours}`;
        const days = Math.floor(hours / 24);
        return `${days} ${t.tasks.timeAgo.days}`;
    }, [approval.created_at, t]);

    return (
        <button
            type="button"
            onClick={() => onOpenDetail(approval)}
            className="group relative w-full rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm
                transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]"
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.bgIcon}`}>
                        <CheckCircle className="h-5 w-5" />
                    </div>
                    <div>
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.color}`}>
                            {meta.label}
                        </span>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                            {approval.entity_id?.slice(0, 8)}...
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Approval level badge */}
                    <div className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-600">
                        <Layers className="h-3 w-3" />
                        Lv.{approval.level + 1}
                    </div>
                    <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-500" />
                </div>
            </div>

            {/* Meta info */}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                {timeAgo && (
                    <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{timeAgo}</span>
                    </div>
                )}
            </div>

            {/* Tap hint */}
            <div className="mt-3 flex items-center justify-center rounded-lg bg-gray-50 py-1.5 text-xs font-medium text-gray-400 transition-colors group-hover:bg-blue-50 group-hover:text-blue-500">
                {t.tasks.tapToView}
            </div>
        </button>
    );
}
