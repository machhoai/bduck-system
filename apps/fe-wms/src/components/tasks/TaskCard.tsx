"use client";

/**
 * TaskCard — Individual task card in the Task Inbox
 *
 * Cards are clickable (opens detail drawer).
 * Approve/Reject buttons moved to TaskDetailDrawer.
 *
 * LUẬT THÉP: i18n (vi + zh), light theme only
 */

import { useMemo } from "react";
import {
    CheckCircle,
    ClipboardEdit,
    Clock,
    User,
    AlertTriangle,
    ChevronRight,
} from "lucide-react";
import { WorkflowNodeType } from "@bduck/shared-types";
import type { WorkflowTask } from "@bduck/shared-types";
import type { Dictionary } from "@/lib/i18n";

interface TaskCardProps {
    task: WorkflowTask;
    onOpenDetail: (task: WorkflowTask) => void;
    t: Dictionary;
}

/** Node type → icon + color */
function getNodeMeta(nodeType: string, t: Dictionary) {
    const map: Record<string, { label: string; color: string; bgIcon: string; icon: React.ElementType }> = {
        [WorkflowNodeType.APPROVAL]: {
            label: t.tasks.nodeType.APPROVAL,
            color: "border-amber-200 bg-amber-50 text-amber-700",
            bgIcon: "bg-amber-100 text-amber-600",
            icon: CheckCircle,
        },
        [WorkflowNodeType.DATA_INPUT]: {
            label: t.tasks.nodeType.DATA_INPUT,
            color: "border-blue-200 bg-blue-50 text-blue-700",
            bgIcon: "bg-blue-100 text-blue-600",
            icon: ClipboardEdit,
        },
    };

    return map[nodeType] || {
        label: nodeType,
        color: "border-gray-200 bg-gray-50 text-gray-600",
        bgIcon: "bg-gray-100 text-gray-500",
        icon: Clock,
    };
}

export default function TaskCard({ task, onOpenDetail, t }: TaskCardProps) {
    const meta = useMemo(() => getNodeMeta(task.node_type, t), [task.node_type, t]);

    const isOverdue = useMemo(() => {
        if (!task.due_at) return false;
        const dueDate = task.due_at instanceof Date ? task.due_at : new Date(task.due_at as any);
        return dueDate < new Date();
    }, [task.due_at]);

    const timeAgo = useMemo(() => {
        if (!task.started_at) return "";
        const d = task.started_at instanceof Date ? task.started_at : new Date(task.started_at as any);
        const diff = Date.now() - d.getTime();
        const minutes = Math.floor(diff / 60000);
        if (minutes < 60) return `${minutes}${t.tasks.timeAgo.minutes}`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}${t.tasks.timeAgo.hours}`;
        const days = Math.floor(hours / 24);
        return `${days} ${t.tasks.timeAgo.days}`;
    }, [task.started_at, t]);

    const IconComponent = meta.icon;

    return (
        <button
            type="button"
            onClick={() => onOpenDetail(task)}
            className={`group relative w-full rounded-xl border bg-white p-4 text-left shadow-sm
                transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 active:scale-[0.98]
                ${isOverdue ? "border-red-300 bg-red-50/30" : "border-gray-100"}`}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${meta.bgIcon}`}>
                        <IconComponent className="h-5 w-5" />
                    </div>
                    <div>
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.color}`}>
                            {meta.label}
                        </span>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                            {task.instance_id?.slice(0, 8)}...
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isOverdue && (
                        <div className="flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                            <AlertTriangle className="h-3 w-3" />
                            {t.tasks.overdue}
                        </div>
                    )}
                    <ChevronRight className="h-4 w-4 text-gray-300 transition-colors group-hover:text-gray-500" />
                </div>
            </div>

            {/* Meta info */}
            <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                {task.assigned_role_id && (
                    <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>{task.assigned_role_id.slice(0, 8)}</span>
                    </div>
                )}
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
