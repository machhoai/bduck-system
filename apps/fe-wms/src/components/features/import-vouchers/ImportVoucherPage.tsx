"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, History, PackagePlus, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useImportVouchers } from "../../../hooks/useImportVouchers";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import CreateVoucherTab from "./CreateVoucherTab";
import HistoryTab from "./HistoryTab";
import ImportVoucherSkeleton from "./ImportVoucherSkeleton";
import InProgressTab from "./InProgressTab";

type TabId = "create" | "inProgress" | "history";

interface TabDef {
    id: TabId;
    labelKey: TabId;
    icon: React.ElementType;
    permission?: string;
}

const TAB_DEFINITIONS: TabDef[] = [
    {
        id: "create",
        labelKey: "create",
        icon: Plus,
        permission: "vouchers.write",
    },
    { id: "inProgress", labelKey: "inProgress", icon: ClipboardList },
    { id: "history", labelKey: "history", icon: History },
];

function MetricCard({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone: "blue" | "emerald" | "amber";
}) {
    const toneClass = {
        blue: "bg-blue-50 text-blue-700",
        emerald: "bg-emerald-50 text-emerald-700",
        amber: "bg-amber-50 text-amber-700",
    }[tone];

    return (
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3 shadow-sm">
            <p className="text-xxs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                {label}
            </p>
            <p
                className={`mt-2 inline-flex rounded-lg px-2 py-1 text-lg font-bold ${toneClass}`}
            >
                {value}
            </p>
        </div>
    );
}

export default function ImportVoucherPage() {
    const { t } = useTranslation();
    const hasPermission = useUserStore((state) => state.hasPermission);
    const searchParams = useSearchParams();
    const prefillWarehouseId = searchParams.get("warehouseId") || undefined;
    const [activeTab, setActiveTab] = useState<TabId>(
        prefillWarehouseId ? "create" : "inProgress",
    );
    const [cloneData, setCloneData] = useState<Record<string, unknown> | null>(
        null,
    );
    const { activeVouchers, completedVouchers, loading } = useImportVouchers();

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

    const pendingApprovalCount = activeVouchers.filter(
        (voucher) => voucher.status === "PENDING_APPROVAL",
    ).length;

    const handleCloneToCreate = (voucherData: Record<string, unknown>) => {
        setActiveTab("create");
        setCloneData(voucherData);
    };

    const handleTabSwitch = (tabId: TabId) => {
        setActiveTab(tabId);
        if (tabId !== "create") setCloneData(null);
    };

    if (loading) {
        return <ImportVoucherSkeleton />;
    }

    return (
        <div className="flex flex-col -mx-4 -mt-2 min-h-[calc(100dvh-80px)] bg-[var(--color-surface-subtle)] pb-24 sm:mx-0 sm:mt-0 sm:bg-transparent sm:pb-0">
            <div className="sticky top-0 z-30 border-b border-[var(--color-border-subtle)] bg-white/95 px-4 pb-3 pt-4 backdrop-blur lg:static lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0">
                <div className="flex items-start gap-3">
                    <div className="flex h-8 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                        <PackagePlus size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg font-bold tracking-normal text-[var(--color-text-primary)]">
                            {t.importVoucher.title}
                        </h1>
                        <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
                            {t.importVoucher.subtitle}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex h-full flex-1 flex-col gap-3">
                <div className="grid grid-cols-3 gap-2 lg:gap-3">
                    <MetricCard
                        label={t.importVoucher.tabs.inProgress}
                        value={activeVouchers.length}
                        tone="blue"
                    />
                    <MetricCard
                        label={t.importVoucher.status.PENDING_APPROVAL}
                        value={pendingApprovalCount}
                        tone="amber"
                    />
                    <MetricCard
                        label={t.importVoucher.tabs.history}
                        value={completedVouchers.length}
                        tone="emerald"
                    />
                </div>

                <div className="sticky top-[88px] z-20 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white/95 p-1 shadow-sm backdrop-blur lg:static">
                    <div className="grid grid-cols-3 gap-1">
                        {visibleTabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = effectiveTab === tab.id;
                            const badgeCount =
                                tab.id === "inProgress"
                                    ? activeVouchers.length
                                    : tab.id === "history"
                                        ? completedVouchers.length
                                        : 0;

                            return (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => handleTabSwitch(tab.id)}
                                    className={`relative flex h-8 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-2 text-xs font-semibold transition-all active:scale-[0.99] sm:text-sm ${isActive
                                        ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                        : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-secondary)]"
                                        }`}
                                >
                                    <Icon size={16} />
                                    <span className="truncate">
                                        {t.importVoucher.tabs[tab.labelKey]}
                                    </span>
                                    {badgeCount > 0 && (
                                        <span
                                            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xxs font-bold ${isActive
                                                ? "bg-white/20 text-white"
                                                : "bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]"
                                                }`}
                                        >
                                            {badgeCount}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex flex-col flex-1">
                    {effectiveTab === "create" && (
                        <CreateVoucherTab
                            cloneData={cloneData}
                            prefillWarehouseId={prefillWarehouseId}
                            onCreated={() => {
                                setCloneData(null);
                                setActiveTab("inProgress");
                            }}
                        />
                    )}

                    {effectiveTab === "inProgress" && (
                        <InProgressTab
                            vouchers={activeVouchers}
                            onClone={handleCloneToCreate}
                        />
                    )}

                    {effectiveTab === "history" && (
                        <HistoryTab
                            vouchers={completedVouchers}
                            onClone={handleCloneToCreate}
                        />
                    )}
                </div>
            </div>
        </div>
    );
}
