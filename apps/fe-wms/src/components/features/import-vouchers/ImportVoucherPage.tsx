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
import { IonIcon } from "@/components/ui/IonIcon";
import { playForward, checkmarkCircle, time } from "ionicons/icons";

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
    icon,
    value,
    tone,
    title
}: {
    icon: React.ReactNode;
    value: number;
    tone: "blue" | "emerald" | "amber";
    title?: string;
}) {
    const toneClass = {
        blue: "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]",
        emerald: "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)]",
        amber: "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
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
        <div className="flex flex-col gap-2 -mx-4 -mt-2 min-h-[calc(100dvh-80px)] bg-[var(--color-surface-subtle)] pb-24 sm:mx-0 sm:mt-0 sm:bg-transparent sm:pb-0">
            <div className="sticky flex justify-between items-center top-0 z-30 border-b border-[var(--color-border-subtle)] bg-white/95 px-4 pb-3 pt-4 backdrop-blur lg:static lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0">
                <div className="flex items-center h-full gap-3">
                    <div className="flex h-full aspect-square shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
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
                <div className="flex h-10 items-center px-4 bg-white rounded-2xl border border-[var(--color-border-subtle)]">
                    <MetricCard
                        icon={<IonIcon icon={playForward} size={18} className="text-[var(--color-status-approved-icon)]" />}
                        value={activeVouchers.length}
                        tone="blue"
                        title={t.importVoucher.tabs.create}
                    />
                    <MetricCard
                        icon={<IonIcon icon={time} size={18} className="text-[var(--color-status-pending-icon)]" />}
                        value={pendingApprovalCount}
                        tone="amber"
                        title={t.importVoucher.tabs.inProgress}
                    />
                    <MetricCard
                        icon={<IonIcon icon={checkmarkCircle} size={18} className="text-[var(--color-success-icon)]" />}
                        value={completedVouchers.length}
                        tone="emerald"
                        title={t.importVoucher.tabs.history}
                    />
                </div>
            </div>

            <div className="flex h-full flex-1 flex-col gap-2">
                <div className="sticky top-[88px] z-20 lg:static">
                    <div className="flex items-center border-b border-[var(--color-border-subtle)]">
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
                                    className={`group relative flex items-center gap-2 px-4 py-2 text-sm font-semibold transition-colors ${isActive
                                        ? "text-[var(--color-brand-primary)]"
                                        : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                                        }`}
                                >
                                    <Icon size={16} className={isActive ? "text-[var(--color-brand-primary)]" : ""} />
                                    <span>{t.importVoucher.tabs[tab.labelKey]}</span>
                                    {badgeCount > 0 && (
                                        <span
                                            className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xxs font-bold ${isActive
                                                ? "bg-[var(--color-brand-primary)] text-white"
                                                : "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"
                                                }`}
                                        >
                                            {badgeCount > 99 ? "99+" : badgeCount}
                                        </span>
                                    )}
                                    {/* Active underline indicator */}
                                    <span
                                        className={`absolute bottom-0 left-2 right-2 h-0.5 rounded-full transition-all duration-200 ${isActive
                                            ? "bg-[var(--color-brand-primary)]"
                                            : "bg-transparent group-hover:bg-[var(--color-border-subtle)]"
                                            }`}
                                    />
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
