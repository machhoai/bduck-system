"use client";

/**
 * TaskInbox - Main Task Inbox component
 *
 * Flow: Task list -> Click card -> TaskDetailDrawer (with approve/reject)
 *
 * LUAT THEP:
 * - Realtime via useApprovalTasks (onSnapshot on pending_approvals)
 * - Skeleton loading (no spinners)
 * - Light Theme only
 * - i18n (vi + zh)
 */

import { useCallback, useMemo, useState } from "react";
import {
    ArrowLeftRight,
    ClipboardCheck,
    Inbox,
    Layers,
    PackageMinus,
    PackagePlus,
    ShoppingCart,
    Sparkles,
} from "lucide-react";
import type { ApprovalRecord } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { useApprovalTasks } from "@/hooks/useApprovalTasks";
import TaskCard from "./TaskCard";
import TaskDetailDrawer from "./TaskDetailDrawer";

const ENTITY_FILTERS = [
    { key: "ALL", icon: Sparkles },
    { key: "IMPORT_VOUCHER", icon: PackagePlus },
    { key: "EXPORT_VOUCHER", icon: PackageMinus },
    { key: "TRANSFER_ORDER", icon: ArrowLeftRight },
    { key: "PURCHASE_ORDER", icon: ShoppingCart },
] as const;

type EntityFilter = (typeof ENTITY_FILTERS)[number]["key"];

function TaskSkeleton() {
    return (
        <div className="animate-pulse rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
                <div className="h-8 w-11 rounded-lg bg-gray-200" />
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3 w-20 rounded bg-gray-200" />
                    <div className="h-4 w-40 rounded bg-gray-200" />
                    <div className="h-3 w-28 rounded bg-gray-100" />
                </div>
                <div className="h-8 w-8 rounded-lg bg-gray-100" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="h-8 rounded-lg bg-gray-100" />
                <div className="h-8 rounded-lg bg-gray-100" />
                <div className="h-8 rounded-lg bg-gray-100" />
            </div>
        </div>
    );
}

function StatTile({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone: "blue" | "emerald" | "amber";
}) {
    const toneClass = {
        blue: "bg-blue-50 text-blue-700 ring-blue-100",
        emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
        amber: "bg-amber-50 text-amber-700 ring-amber-100",
    }[tone];

    return (
        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase text-gray-400">{label}</p>
            <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-lg font-bold text-gray-950">{value}</span>
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${toneClass}`}>
                    <Layers className="h-4 w-4" />
                </span>
            </div>
        </div>
    );
}

function EntityFilterButton({
    filter,
    active,
    count,
    label,
    onClick,
}: {
    filter: (typeof ENTITY_FILTERS)[number];
    active: boolean;
    count: number;
    label: string;
    onClick: () => void;
}) {
    const Icon = filter.icon;

    return (
        <button
            type="button"
            onClick={onClick}
            className={`flex h-8 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors active:scale-[0.98] ${
                active
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50"
            }`}
        >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
            <span
                className={`rounded-full px-2 py-0.5 text-xxs ${
                    active ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"
                }`}
            >
                {count}
            </span>
        </button>
    );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
    return (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-4 py-14 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-50">
                <Inbox className="h-7 w-7 text-gray-300" />
            </div>
            <p className="mt-4 text-sm font-semibold text-gray-700">{title}</p>
            <p className="mt-1 text-xs text-gray-400">{hint}</p>
        </div>
    );
}

export default function TaskInbox() {
    const { t } = useTranslation();
    const { myTasks, loading } = useApprovalTasks();
    const [selectedTask, setSelectedTask] = useState<ApprovalRecord | null>(null);
    const [activeFilter, setActiveFilter] = useState<EntityFilter>("ALL");

    const handleOpenDetail = useCallback((task: ApprovalRecord) => {
        setSelectedTask(task);
    }, []);

    const handleCloseDetail = useCallback(() => {
        setSelectedTask(null);
    }, []);

    const taskStats = useMemo(() => {
        const importCount = myTasks.filter((task) => task.entity_type === "IMPORT_VOUCHER").length;
        const exportCount = myTasks.filter((task) => task.entity_type === "EXPORT_VOUCHER").length;
        const levelCount = new Set(myTasks.map((task) => task.level)).size;

        return {
            total: myTasks.length,
            importCount,
            exportCount,
            levelCount,
        };
    }, [myTasks]);

    const filterCounts = useMemo(() => {
        const counts: Record<EntityFilter, number> = {
            ALL: myTasks.length,
            IMPORT_VOUCHER: 0,
            EXPORT_VOUCHER: 0,
            TRANSFER_ORDER: 0,
            PURCHASE_ORDER: 0,
        };

        myTasks.forEach((task) => {
            if (task.entity_type in counts) {
                counts[task.entity_type as EntityFilter] += 1;
            }
        });

        return counts;
    }, [myTasks]);

    const visibleTasks = useMemo(() => {
        if (activeFilter === "ALL") return myTasks;
        return myTasks.filter((task) => task.entity_type === activeFilter);
    }, [activeFilter, myTasks]);

    return (
        <div className="flex w-full flex-col gap-5">
            <div className="rounded-lg border border-gray-100 bg-white px-4 py-5 shadow-sm sm:px-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                            <ClipboardCheck className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                            <p className="text-xs font-semibold uppercase text-blue-600">
                                {t.tasks.workspaceLabel}
                            </p>
                            <h1 className="mt-1 text-lg font-bold text-gray-950">{t.tasks.title}</h1>
                            <p className="mt-1 text-sm text-gray-500">
                                {loading
                                    ? t.tasks.loading
                                    : `${taskStats.total} ${t.tasks.pendingCount}`}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 lg:w-[420px]">
                        <StatTile label={t.tasks.stats.total} value={taskStats.total} tone="blue" />
                        <StatTile label={t.tasks.stats.imports} value={taskStats.importCount} tone="emerald" />
                        <StatTile label={t.tasks.stats.exports} value={taskStats.exportCount} tone="amber" />
                    </div>
                </div>
            </div>

            <div className="flex w-full gap-4 overflow-x-auto pb-1">
                {ENTITY_FILTERS.map((filter) => (
                    <EntityFilterButton
                        key={filter.key}
                        filter={filter}
                        active={activeFilter === filter.key}
                        count={filterCounts[filter.key]}
                        label={
                            filter.key === "ALL"
                                ? t.tasks.filters.all
                                : t.tasks.entityType[filter.key]
                        }
                        onClick={() => setActiveFilter(filter.key)}
                    />
                ))}
            </div>

            <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
                <section className="min-w-0">
                    <div className="mb-3 flex items-center justify-between gap-3">
                        <div>
                            <h2 className="text-base font-bold text-gray-950">{t.tasks.queueTitle}</h2>
                            <p className="text-xs text-gray-500">
                                {loading
                                    ? t.tasks.loading
                                    : `${visibleTasks.length} ${t.tasks.visibleCount}`}
                            </p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                            {Array.from({ length: 6 }).map((_, i) => (
                                <TaskSkeleton key={i} />
                            ))}
                        </div>
                    ) : visibleTasks.length === 0 ? (
                        <EmptyState title={t.tasks.empty} hint={t.tasks.emptyHint} />
                    ) : (
                        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                            {visibleTasks.map((task) => (
                                <TaskCard
                                    key={task.id}
                                    approval={task}
                                    onOpenDetail={handleOpenDetail}
                                    t={t}
                                />
                            ))}
                        </div>
                    )}
                </section>

                <aside className="hidden xl:block">
                    <div className="sticky top-4 space-y-3">
                        <div className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                            <p className="text-xs font-semibold uppercase text-gray-400">
                                {t.tasks.summary.title}
                            </p>
                            <div className="mt-4 space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">{t.tasks.summary.levels}</span>
                                    <span className="text-sm font-bold text-gray-950">
                                        {taskStats.levelCount}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">{t.tasks.summary.imports}</span>
                                    <span className="text-sm font-bold text-emerald-700">
                                        {taskStats.importCount}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-gray-500">{t.tasks.summary.exports}</span>
                                    <span className="text-sm font-bold text-amber-700">
                                        {taskStats.exportCount}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                            <p className="text-sm font-semibold text-blue-800">
                                {t.tasks.summary.realtimeTitle}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-blue-700">
                                {t.tasks.summary.realtimeHint}
                            </p>
                        </div>
                    </div>
                </aside>
            </div>

            {selectedTask && (
                <TaskDetailDrawer approval={selectedTask} onClose={handleCloseDetail} />
            )}
        </div>
    );
}
