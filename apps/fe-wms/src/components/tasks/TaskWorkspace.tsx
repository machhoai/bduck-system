"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
    CheckCircle2,
    ClipboardCheck,
    ClipboardList,
    AlertTriangle,
    PackageCheck,
    Scale,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import { useApprovalTasks } from "@/hooks/useApprovalTasks";
import { useUnifiedVouchers } from "@/hooks/useUnifiedVouchers";
import {
    countActionableNonconformities,
    useNonconformities,
} from "@/hooks/useNonconformities";
import { useUserStore } from "@/stores/useUserStore";
import NonconformityTaskTab from "./NonconformityTaskTab";
import TaskInbox from "./TaskInbox";
import TaskVoucherActionTab from "./TaskVoucherActionTab";
import {
    countCompletionVouchers,
    countSessionVouchers,
} from "./taskVoucherActionUtils";

type WorkbenchTab = "approvals" | "sessions" | "completions" | "nonconformities";

const TABS: Array<{
    id: WorkbenchTab;
    icon: React.ElementType;
}> = [
        { id: "approvals", icon: ClipboardCheck },
        { id: "sessions", icon: ClipboardList },
        { id: "completions", icon: PackageCheck },
        { id: "nonconformities", icon: AlertTriangle },
    ];

function parseWorkbenchTab(value: string | null): WorkbenchTab | null {
    if (
        value === "approvals" ||
        value === "sessions" ||
        value === "completions" ||
        value === "nonconformities"
    ) {
        return value;
    }
    return null;
}

function StatTile({
    label,
    value,
    icon: Icon,
    onClick,
    isActive,
}: {
    label: string;
    value: number;
    icon: React.ElementType;
    onClick?: () => void;
    isActive?: boolean;
}) {
    const clickable = Boolean(onClick);
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={!clickable}
            className={`w-full text-left rounded-lg border p-3 shadow-sm transition-all duration-200 ${clickable ? "cursor-pointer hover:translate-y-[-1px] hover:shadow-md" : "cursor-not-allowed"
                } ${isActive
                    ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                    : "border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] hover:bg-[var(--color-surface-card)]"
                }`}
        >
            <p className="text-xs font-semibold text-[var(--color-text-muted)]">
                {label}
            </p>
            <div className="mt-1 flex items-center justify-between gap-3">
                <span className="text-lg font-bold text-[var(--color-text-primary)]">
                    {value}
                </span>
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ring-1 transition-colors ${isActive
                    ? "bg-[var(--color-brand-primary)] text-white ring-[var(--color-brand-primary)]"
                    : "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)] ring-[var(--color-status-approved-border)]"
                    }`}>
                    <Icon className="h-4 w-4" />
                </span>
            </div>
        </button>
    );
}

export default function TaskWorkspace() {
    const { t } = useTranslation();
    const searchParams = useSearchParams();
    const hasPermission = useUserStore((state) => state.hasPermission);
    const canResolveNonconformities = hasPermission("inventory.write");
    const { myTasks, loading: loadingApprovals } = useApprovalTasks();
    const { activeVouchers, loading: loadingVouchers } = useUnifiedVouchers();
    const { reports, loading: loadingNonconformities } = useNonconformities({
        enabled: canResolveNonconformities,
    });
    const [activeTab, setActiveTab] = useState<WorkbenchTab>(
        (() => {
            const tabFromUrl = parseWorkbenchTab(searchParams.get("tab"));
            if (tabFromUrl === "nonconformities" && !canResolveNonconformities) {
                return "approvals";
            }
            return (
                tabFromUrl ||
                (searchParams.get("reportId") && canResolveNonconformities
                    ? "nonconformities"
                    : "approvals")
            );
        })(),
    );
    const initialReportId = searchParams.get("reportId");
    const visibleTabs = useMemo(
        () =>
            TABS.filter(
                (tab) => tab.id !== "nonconformities" || canResolveNonconformities,
            ),
        [canResolveNonconformities],
    );

    useEffect(() => {
        const tabFromUrl = parseWorkbenchTab(searchParams.get("tab"));
        if (tabFromUrl === "nonconformities" && !canResolveNonconformities) {
            setActiveTab("approvals");
            return;
        }
        if (tabFromUrl) {
            setActiveTab(tabFromUrl);
            return;
        }
        if (searchParams.get("reportId") && canResolveNonconformities) {
            setActiveTab("nonconformities");
        }
    }, [canResolveNonconformities, searchParams]);

    const counts = useMemo(
        () => ({
            approvals: myTasks.length,
            sessions: countSessionVouchers(activeVouchers),
            completions: countCompletionVouchers(activeVouchers),
            nonconformities: canResolveNonconformities
                ? countActionableNonconformities(reports)
                : 0,
        }),
        [activeVouchers, canResolveNonconformities, myTasks.length, reports],
    );

    const total =
        counts.approvals +
        counts.sessions +
        counts.completions +
        counts.nonconformities;
    const loading =
        loadingApprovals ||
        loadingVouchers ||
        (canResolveNonconformities && loadingNonconformities);

    return (
        <div className="flex w-full flex-col gap-5 pb-3">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-14 aspect-square shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)] ring-1 ring-[var(--color-status-approved-border)]">
                        <Scale className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-lg font-semibold text-[var(--color-text-primary)]">
                            {t.tasks.title}
                        </h1>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {loading
                                ? t.tasks.loading
                                : `${total} ${t.tasks.pendingCount}`}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2 lg:w-[640px] lg:grid-cols-4">
                    <StatTile
                        label={t.tasks.workbench.tabs.approvals}
                        value={counts.approvals}
                        icon={ClipboardCheck}
                        onClick={() => setActiveTab("approvals")}
                        isActive={activeTab === "approvals"}
                    />
                    <StatTile
                        label={t.tasks.workbench.tabs.sessions}
                        value={counts.sessions}
                        icon={ClipboardList}
                        onClick={() => setActiveTab("sessions")}
                        isActive={activeTab === "sessions"}
                    />
                    <StatTile
                        label={t.tasks.workbench.tabs.completions}
                        value={counts.completions}
                        icon={CheckCircle2}
                        onClick={() => setActiveTab("completions")}
                        isActive={activeTab === "completions"}
                    />
                    <StatTile
                        label={t.tasks.workbench.tabs.nonconformities}
                        value={counts.nonconformities}
                        icon={AlertTriangle}
                        onClick={canResolveNonconformities ? () => setActiveTab("nonconformities") : undefined}
                        isActive={activeTab === "nonconformities"}
                    />
                </div>
            </div>

            <div className="hidden md:flex w-full gap-2 overflow-x-auto border-b border-[var(--color-border-soft)] pb-0">
                {visibleTabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`relative flex h-10 shrink-0 items-center gap-2 px-3 text-sm font-semibold transition-colors ${isActive
                                ? "text-[var(--color-brand-primary)]"
                                : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                                }`}
                        >
                            <Icon className="h-4 w-4" />
                            <span>{t.tasks.workbench.tabs[tab.id]}</span>
                            {counts[tab.id] > 0 && (
                                <span
                                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xxs font-bold ${isActive
                                        ? "bg-[var(--color-brand-primary)] text-white"
                                        : "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"
                                        }`}
                                >
                                    {counts[tab.id] > 99 ? "99+" : counts[tab.id]}
                                </span>
                            )}
                            <span
                                className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full ${isActive ? "bg-[var(--color-brand-primary)]" : "bg-transparent"
                                    }`}
                            />
                        </button>
                    );
                })}
            </div>

            {activeTab === "approvals" && <TaskInbox compact />}
            {activeTab === "sessions" && (
                <TaskVoucherActionTab
                    mode="sessions"
                    vouchers={activeVouchers}
                    loading={loadingVouchers}
                />
            )}
            {activeTab === "completions" && (
                <TaskVoucherActionTab
                    mode="completions"
                    vouchers={activeVouchers}
                    loading={loadingVouchers}
                />
            )}
            {activeTab === "nonconformities" && canResolveNonconformities && (
                <NonconformityTaskTab
                    reports={reports}
                    loading={loadingNonconformities}
                    initialReportId={initialReportId}
                />
            )}
        </div>
    );
}
