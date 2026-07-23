"use client";

import { CalendarCheck, ClipboardList } from "lucide-react";

export type EmployeeAdminTabKey = "admin" | "time";

interface EmployeeAdminTabsProps {
    activeTab: EmployeeAdminTabKey;
    labels: Record<string, string>;
    onChange: (tab: EmployeeAdminTabKey) => void;
}

const tabs: Array<{
    key: EmployeeAdminTabKey;
    icon: typeof ClipboardList;
    labelKey: string;
}> = [
        { key: "time", icon: CalendarCheck, labelKey: "timeTab" },
        { key: "admin", icon: ClipboardList, labelKey: "adminTab" },
    ];

export function EmployeeAdminTabs({
    activeTab,
    labels,
    onChange,
}: EmployeeAdminTabsProps) {
    return (
        <div className="sticky top-2 z-20 rounded-full border border-white/80 bg-white/95 p-1 shadow-sm backdrop-blur lg:static lg:w-fit lg:border-[var(--color-border-soft)]">
            <div className="grid grid-cols-2 gap-1 lg:flex">
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => onChange(tab.key)}
                            className={`inline-flex h-11 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-all active:scale-[0.98] lg:min-w-36 ${active
                                ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)]"
                                }`}
                        >
                            <Icon size={16} />
                            <span className="truncate">{labels[tab.labelKey]}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
