"use client";

/**
 * TaskInbox — Main Task Inbox component
 *
 * Flow: Task list → Click card → TaskDetailDrawer (with approve/reject)
 *
 * LUẬT THÉP:
 * - Realtime via useApprovalTasks (onSnapshot on pending_approvals)
 * - Skeleton loading (no spinners)
 * - Light Theme only
 * - i18n (vi + zh)
 */

import { useState, useCallback } from "react";
import { ClipboardCheck, Inbox } from "lucide-react";
import type { ApprovalRecord } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { useApprovalTasks } from "@/hooks/useApprovalTasks";
import TaskCard from "./TaskCard";
import TaskDetailDrawer from "./TaskDetailDrawer";

/** Skeleton for loading state */
function TaskSkeleton() {
    return (
        <div className="animate-pulse rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gray-200" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-16 rounded bg-gray-200" />
                    <div className="h-4 w-24 rounded bg-gray-200" />
                </div>
            </div>
            <div className="mt-3 flex gap-2">
                <div className="h-3 w-20 rounded bg-gray-200" />
                <div className="h-3 w-20 rounded bg-gray-200" />
            </div>
            <div className="mt-3 h-8 rounded-lg bg-gray-100" />
        </div>
    );
}

export default function TaskInbox() {
    const { t } = useTranslation();
    const { myTasks, loading } = useApprovalTasks();
    const [selectedTask, setSelectedTask] = useState<ApprovalRecord | null>(null);

    const handleOpenDetail = useCallback((task: ApprovalRecord) => {
        setSelectedTask(task);
    }, []);

    const handleCloseDetail = useCallback(() => {
        setSelectedTask(null);
    }, []);

    return (
        <div className="mx-auto max-w-4xl">
            {/* Header */}
            <div className="mb-6 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
                    <ClipboardCheck className="h-5.5 w-5.5 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-gray-900">{t.tasks.title}</h1>
                    <p className="text-sm text-gray-500">
                        {loading
                            ? t.tasks.loading
                            : `${myTasks.length} ${t.tasks.pendingCount}`}
                    </p>
                </div>
            </div>

            {/* Task list */}
            {loading ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <TaskSkeleton key={i} />
                    ))}
                </div>
            ) : myTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/50 py-16">
                    <Inbox className="h-12 w-12 text-gray-300" />
                    <p className="mt-3 text-sm font-medium text-gray-500">{t.tasks.empty}</p>
                    <p className="mt-1 text-xs text-gray-400">{t.tasks.emptyHint}</p>
                </div>
            ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                    {myTasks.map((task) => (
                        <TaskCard
                            key={task.id}
                            approval={task}
                            onOpenDetail={handleOpenDetail}
                            t={t}
                        />
                    ))}
                </div>
            )}

            {/* Detail Drawer */}
            {selectedTask && (
                <TaskDetailDrawer approval={selectedTask} onClose={handleCloseDetail} />
            )}
        </div>
    );
}
