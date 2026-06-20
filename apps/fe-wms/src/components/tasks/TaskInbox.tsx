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

import { useCallback, useEffect, useMemo, useState } from "react";
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

interface TaskInboxProps {
  compact?: boolean;
}

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
    <div className="animate-pulse rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="h-8 w-11 rounded-lg bg-[var(--color-skeleton-base)]" />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3 w-20 rounded bg-[var(--color-skeleton-base)]" />
          <div className="h-4 w-40 rounded bg-[var(--color-skeleton-base)]" />
          <div className="h-3 w-28 rounded bg-[var(--color-neutral-100)]" />
        </div>
        <div className="h-8 w-8 rounded-lg bg-[var(--color-neutral-100)]" />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <div className="h-8 rounded-lg bg-[var(--color-neutral-100)]" />
        <div className="h-8 rounded-lg bg-[var(--color-neutral-100)]" />
        <div className="h-8 rounded-lg bg-[var(--color-neutral-100)]" />
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
    blue: "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)] ring-[var(--color-status-approved-border)]",
    emerald:
      "bg-[var(--color-success-bg)] text-[var(--color-success-text)] ring-[var(--color-success-border)]",
    amber:
      "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)] ring-[var(--color-status-pending-border)]",
  }[tone];

  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3 shadow-sm">
      <p className="text-xs font-semibold text-[var(--color-text-muted)]">
        {label}
      </p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <span className="text-lg font-bold text-[var(--color-text-primary)]">
          {value}
        </span>
        <span
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${toneClass}`}
        >
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
          ? "border-[var(--color-status-approved-border)] bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]"
          : "border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-subtle)] hover:bg-[var(--color-neutral-50)]"
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
      <span
        className={`rounded-full px-2 py-0.5 text-xxs ${
          active
            ? "bg-[var(--color-status-approved-bg-muted)] text-[var(--color-status-approved-text)]"
            : "bg-[var(--color-neutral-100)] text-[var(--color-text-muted)]"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex min-h-[320px] w-full flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-[var(--color-neutral-50)]">
        <Inbox className="h-7 w-7 text-[var(--color-neutral-300)]" />
      </div>
      <p className="mt-4 text-sm font-semibold text-[var(--color-text-secondary)]">
        {title}
      </p>
      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{hint}</p>
    </div>
  );
}

export default function TaskInbox({ compact = false }: TaskInboxProps) {
  const { t } = useTranslation();
  const { myTasks, selfCreatedIds, loading } = useApprovalTasks();
  const [selectedTask, setSelectedTask] = useState<ApprovalRecord | null>(null);
  const [activeFilter, setActiveFilter] = useState<EntityFilter>("ALL");

  const handleOpenDetail = useCallback((task: ApprovalRecord) => {
    setSelectedTask(task);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedTask(null);
  }, []);

  const taskStats = useMemo(() => {
    const importCount = myTasks.filter(
      (task) => task.entity_type === "IMPORT_VOUCHER",
    ).length;
    const exportCount = myTasks.filter(
      (task) => task.entity_type === "EXPORT_VOUCHER",
    ).length;
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

  useEffect(() => {
    if (loading || selectedTask || typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const approvalId = params.get("approvalId");
    const entityType = params.get("entityType");
    const entityId = params.get("entityId");

    const targetTask = myTasks.find((task) => {
      if (approvalId) return task.id === approvalId;
      return (
        task.entity_id === entityId &&
        (!entityType || task.entity_type === entityType)
      );
    });
    if (!targetTask) return;

    setActiveFilter(
      ENTITY_FILTERS.some((filter) => filter.key === targetTask.entity_type)
        ? (targetTask.entity_type as EntityFilter)
        : "ALL",
    );
    setSelectedTask(targetTask);
  }, [loading, myTasks, selectedTask]);

  return (
    <div className="flex w-full flex-col gap-5">
      {!compact && (
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-14 aspect-square shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)] ring-1 ring-[var(--color-status-approved-border)]">
              <ClipboardCheck className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase text-[var(--color-brand-primary)]">
                {t.tasks.workspaceLabel}
              </p>
              <h1 className="text-lg font-bold text-[var(--color-text-primary)]">
                {t.tasks.title}
              </h1>
              <p className="text-sm text-[var(--color-text-muted)]">
                {loading
                  ? t.tasks.loading
                  : `${taskStats.total} ${t.tasks.pendingCount}`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 lg:w-[420px]">
            <StatTile
              label={t.tasks.stats.total}
              value={taskStats.total}
              tone="blue"
            />
            <StatTile
              label={t.tasks.stats.imports}
              value={taskStats.importCount}
              tone="emerald"
            />
            <StatTile
              label={t.tasks.stats.exports}
              value={taskStats.exportCount}
              tone="amber"
            />
          </div>
        </div>
      )}

      <div className="flex w-full gap-2 overflow-x-auto pb-1">
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

      <div className="flex w-full gap-4">
        <section className="flex-1 ">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-[var(--color-text-primary)]">
                {t.tasks.queueTitle}
              </h2>
              <p className="text-xs text-[var(--color-text-muted)]">
                {loading
                  ? t.tasks.loading
                  : `${visibleTasks.length} ${t.tasks.visibleCount}`}
              </p>
            </div>
          </div>

          <div className="flex w-full gap-2">
            {loading ? (
              <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3 flex-1">
                {Array.from({ length: 6 }).map((_, i) => (
                  <TaskSkeleton key={i} />
                ))}
              </div>
            ) : visibleTasks.length === 0 ? (
              <EmptyState title={t.tasks.empty} hint={t.tasks.emptyHint} />
            ) : (
              <div className="flex flex-col gap-3 flex-1">
                {visibleTasks.map((task) => (
                  <TaskCard
                    key={task.id}
                    approval={task}
                    isSelfCreated={selfCreatedIds.has(task.id)}
                    onOpenDetail={handleOpenDetail}
                    t={t}
                  />
                ))}
              </div>
            )}

            <aside className="hidden xl:block h-full">
              <div className="sticky top-4 space-y-3">
                <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 shadow-sm">
                  <p className="text-xs font-semibold uppercase text-[var(--color-text-muted)]">
                    {t.tasks.summary.title}
                  </p>
                  <div className="mt-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-muted)]">
                        {t.tasks.summary.levels}
                      </span>
                      <span className="text-sm font-bold text-[var(--color-text-primary)]">
                        {taskStats.levelCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-muted)]">
                        {t.tasks.summary.imports}
                      </span>
                      <span className="text-sm font-bold text-[var(--color-success-text-strong)]">
                        {taskStats.importCount}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-[var(--color-text-muted)]">
                        {t.tasks.summary.exports}
                      </span>
                      <span className="text-sm font-bold text-[var(--color-status-pending-text)]">
                        {taskStats.exportCount}
                      </span>
                    </div>
                    {/* <div className="flex items-center justify-between">
                                            <span className="text-sm text-[var(--color-text-muted)]">{t.tasks.summary.transfers}</span>
                                            <span className="text-sm font-bold text-[var(--color-status-pending-text)]">
                                                {taskStats.transferCount}
                                            </span>
                                        </div> */}
                  </div>
                </div>
                <div className="rounded-lg border border-[var(--color-status-approved-border)] bg-[var(--color-status-approved-bg)] p-4">
                  <p className="text-sm font-semibold text-[var(--color-status-approved-text)]">
                    {t.tasks.summary.realtimeTitle}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[var(--color-status-approved-text)]">
                    {t.tasks.summary.realtimeHint}
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>
      </div>

      {selectedTask && (
        <TaskDetailDrawer
          approval={selectedTask}
          isSelfCreated={selfCreatedIds.has(selectedTask.id)}
          onClose={handleCloseDetail}
        />
      )}
    </div>
  );
}
