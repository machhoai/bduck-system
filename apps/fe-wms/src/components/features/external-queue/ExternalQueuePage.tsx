"use client";

import { useState } from "react";
import { ClipboardList, History, ScanBarcode } from "lucide-react";
import { useTranslation } from "../../../lib/i18n";
import ExternalQueuePendingTab from "./ExternalQueuePendingTab";
import ExternalQueueHistoryTab from "./ExternalQueueHistoryTab";

type TabId = "pending" | "history";

interface TabDef {
    id: TabId;
    labelKey: TabId;
    icon: React.ElementType;
}

const TAB_DEFINITIONS: TabDef[] = [
    { id: "pending", labelKey: "pending", icon: ClipboardList },
    { id: "history", labelKey: "history", icon: History },
];

export default function ExternalQueuePage() {
    const { t } = useTranslation();
    const externalQueueText = (t as any).externalQueue;
    const [activeTab, setActiveTab] = useState<TabId>("pending");

    const handleTabSwitch = (tabId: TabId) => {
        setActiveTab(tabId);
    };

    return (
        <div className="flex flex-col gap-2 -mx-4 -mt-2 min-h-[calc(100dvh-80px)] bg-[var(--color-surface-subtle)] pb-24 sm:mx-0 sm:mt-0 sm:bg-transparent sm:pb-0">
            <div className="sticky flex justify-between items-center top-0 z-30 border-b border-[var(--color-border-subtle)] bg-white/95 px-4 pb-3 pt-4 backdrop-blur lg:static lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0">
                <div className="flex items-center h-full gap-3">
                    <div className="flex h-full aspect-square shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                        <ScanBarcode size={22} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-lg font-bold tracking-normal text-[var(--color-text-primary)]">
                            {externalQueueText?.title || "Quét mã ngoài"}
                        </h1>
                        <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
                            {externalQueueText?.subtitle || "Duyệt yêu cầu xuất kho từ thiết bị bên ngoài (như máy POS)"}
                        </p>
                    </div>
                </div>
            </div>

            <div className="flex h-full flex-1 flex-col gap-2">
                <div className="sticky top-[88px] z-20 lg:static">
                    <div className="flex items-center border-b border-[var(--color-border-subtle)]">
                        {TAB_DEFINITIONS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;
                            const label = externalQueueText?.tabs?.[tab.labelKey] || tab.labelKey;

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
                                    <span>{label}</span>
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

                <div className="flex flex-col flex-1 p-3">
                    {activeTab === "pending" && <ExternalQueuePendingTab />}
                    {activeTab === "history" && <ExternalQueueHistoryTab />}
                </div>
            </div>
        </div>
    );
}
