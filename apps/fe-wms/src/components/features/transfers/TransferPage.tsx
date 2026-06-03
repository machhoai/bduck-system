"use client";

import { useMemo, useState, useEffect } from "react";
import {
    ArrowRightLeft,
    ClipboardList,
    History,
    Plus,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTransferOrders } from "../../../hooks/useTransferOrders";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import CreateTransferTab from "./CreateTransferTab";
import TransferDetailDrawer from "./TransferDetailDrawer";
import TransferListTab from "./TransferListTab";
import TransferSkeleton from "./TransferSkeleton";
import IonIcon from "@/components/ui/IonIcon";
import { time } from "console";
import { playForward, checkmarkCircle, timer } from "ionicons/icons";

type TabId = "create" | "inProgress" | "history";

interface TabDef {
    id: TabId;
    labelKey: TabId;
    icon: React.ElementType;
    permission?: string;
}

const TAB_DEFINITIONS: TabDef[] = [
    { id: "create", labelKey: "create", icon: Plus, permission: "transfers.write" },
    { id: "inProgress", labelKey: "inProgress", icon: ClipboardList },
    { id: "history", labelKey: "history", icon: History },
];

function MetricCard({
    icon,
    value,
    tone,
    title
}: {
    icon: React.ReactNode;
    value: number;
    tone: "orange" | "amber" | "emerald";
    title?: string;
}) {
    const toneClass = {
        orange: "bg-[var(--color-status-export-bg)] text-[var(--color-status-export-text)]",
        amber: "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
        emerald: "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)]",
    }[tone];

    return (
        <div
            className="flex items-center justify-center gap-1 px-2"
            title={title}
        >
            {icon}
            <p
                className={`leading-0 inline-flex !bg-transparent text-md font-bold ${toneClass}`}
            >
                {value}
            </p>
        </div>
    );
}

export default function TransferPage() {
    const { t } = useTranslation();
    const hasPermission = useUserStore((state) => state.hasPermission);
    const searchParams = useSearchParams();
    const prefillWarehouseId = searchParams.get("warehouseId") || undefined;
    const [activeTab, setActiveTab] = useState<TabId>(
        prefillWarehouseId ? "create" : "inProgress",
    );
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
    const { activeOrders, completedOrders, loading } = useTransferOrders();

    useEffect(() => {
        if (prefillWarehouseId) {
            setActiveTab("create");
        }
    }, [prefillWarehouseId]);

    const visibleTabs = useMemo(
        () =>
            TAB_DEFINITIONS.filter((tab) => {
                if (!tab.permission) return true;
                return hasPermission(tab.permission);
            }),
        [hasPermission],
    );

    const effectiveTab = useMemo(() => {
        if (visibleTabs.some((tab) => tab.id === activeTab)) return activeTab;
        return visibleTabs[0]?.id ?? "inProgress";
    }, [activeTab, visibleTabs]);

    const pendingApprovalCount = activeOrders.filter(
        (o) => o.status === "PENDING_APPROVAL",
    ).length;
    const transferText = t.transfer as typeof t.transfer & {
        metrics?: Record<string, string>;
    };

    const handleTabSwitch = (tabId: TabId) => {
        setActiveTab(tabId);
    };

    if (loading) {
        return <TransferSkeleton />;
    }

    return (
        <div className="flex flex-col gap-2 -mx-4 -mt-2 min-h-[calc(100dvh-80px)] bg-[var(--color-surface-subtle)] pb-24 sm:mx-0 sm:mt-0 sm:bg-transparent sm:pb-0">
            {/* Header */}
            <div className="sticky flex justify-between items-center top-0 z-30 border-b border-[var(--color-border-subtle)] bg-white/95 px-4 pb-3 pt-4 backdrop-blur lg:static lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0">
                <div className="flex items-start h-full gap-3">
                    <div className="flex h-full aspect-square shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-status-export-bg)] text-[var(--color-status-export-text)]">
                        <ArrowRightLeft size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] lg:text-lg">
                            {t.transfer.title}
                        </h1>
                        <p className="text-xs text-[var(--color-text-muted)] lg:text-sm">
                            {t.transfer.subtitle}
                        </p>
                    </div>
                </div>
                {/* Metrics */}
                <div className="flex h-10 items-center px-4 bg-white rounded-2xl border border-[var(--color-border-subtle)]">
                    <MetricCard
                        title={transferText.metrics?.inProgress ?? t.transfer.tabs.inProgress}
                        value={activeOrders.length}
                        tone="orange"
                        icon={<IonIcon icon={playForward} size={18} className="text-[var(--color-status-export-icon)]" />}
                    />
                    <MetricCard
                        title={transferText.metrics?.pendingApproval ?? t.transfer.status.PENDING_APPROVAL}
                        value={pendingApprovalCount}
                        tone="amber"
                        icon={<IonIcon icon={timer} size={18} className="text-[var(--color-status-pending-icon)]" />}
                    />
                    <MetricCard
                        title={transferText.metrics?.completed ?? t.transfer.status.COMPLETED}
                        value={completedOrders.length}
                        tone="emerald"
                        icon={<IonIcon icon={checkmarkCircle} size={18} className="text-[var(--color-success-icon)]" />}
                    />
                </div>
            </div>

            {/* Content */}
            <div className="flex h-full flex-1 flex-col gap-2">
                {/* Tab bar */}
                <div className="sticky top-[88px] z-20 lg:static">
                    <div className="flex items-center border-b border-[var(--color-border-subtle)]">
                        {visibleTabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = effectiveTab === tab.id;
                            const badgeCount =
                                tab.id === "inProgress"
                                    ? activeOrders.length
                                    : tab.id === "history"
                                        ? completedOrders.length
                                        : 0;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => handleTabSwitch(tab.id)}
                                    className={`group relative flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${isActive
                                        ? "text-[var(--color-status-export-text)]"
                                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                                        }`}
                                >
                                    <Icon size={16} className={isActive ? "text-[var(--color-status-export-text)]" : ""} />
                                    <span>{t.transfer.tabs[tab.labelKey]}</span>
                                    {badgeCount > 0 && (
                                        <span
                                            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xxs font-bold ${isActive
                                                ? "bg-[var(--color-status-export-icon)] text-[var(--color-text-on-dark)]"
                                                : "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"
                                                }`}
                                        >
                                            {badgeCount > 99 ? "99+" : badgeCount}
                                        </span>
                                    )}
                                    {/* Active underline indicator */}
                                    <span
                                        className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full transition-all duration-200 ${isActive
                                            ? "bg-[var(--color-status-export-icon)]"
                                            : "bg-transparent group-hover:bg-[var(--color-border-subtle)]"
                                            }`}
                                    />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Tab content */}
                {effectiveTab === "create" && (
                    <CreateTransferTab
                        prefillWarehouseId={prefillWarehouseId}
                        onCreated={() => setActiveTab("inProgress")}
                    />
                )}
                {effectiveTab === "inProgress" && (
                    <TransferListTab
                        orders={activeOrders}
                        onViewDetail={(id) => setSelectedOrderId(id)}
                    />
                )}
                {effectiveTab === "history" && (
                    <TransferListTab
                        orders={completedOrders}
                        onViewDetail={(id) => setSelectedOrderId(id)}
                    />
                )}

                {/* Detail Drawer */}
                {selectedOrderId && (
                    <TransferDetailDrawer
                        orderId={selectedOrderId}
                        onClose={() => setSelectedOrderId(null)}
                    />
                )}
            </div>
        </div>
    );
}
