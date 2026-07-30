"use client";

import {
    CalendarCheck2,
    ClipboardList,
    FileText,
    UserRound,
} from "lucide-react";
import type { ReactNode } from "react";

import type { EmployeeDetailTabKey } from "./employeeDetailTabPolicy";
import type { EmployeeDetailTabsLabels } from "./employeeDetailTabsTranslations";

const tabIcons: Record<EmployeeDetailTabKey, ReactNode> = {
    profile: <UserRound className="h-5 w-5" />,
    contracts: <FileText className="h-5 w-5" />,
    leave: <ClipboardList className="h-5 w-5" />,
    attendance: <CalendarCheck2 className="h-5 w-5" />,
};

type EmployeeDetailTabsProps = {
    tabs: EmployeeDetailTabKey[];
    activeTab: EmployeeDetailTabKey;
    labels: EmployeeDetailTabsLabels["tabs"];
    onChange: (tab: EmployeeDetailTabKey) => void;
};

export function EmployeeDetailTabs({
    tabs,
    activeTab,
    labels,
    onChange,
}: EmployeeDetailTabsProps) {
    return (
        <div
            aria-label={labels.profile}
            className="flex gap-1 h-12 min-h-12 mt-2 overflow-x-auto border-slate-200 bg-white md:px-6"
            role="tablist"
        >
            {tabs.map((tab) => (
                <button
                    aria-controls={`employee-detail-panel-${tab}`}
                    aria-selected={activeTab === tab}
                    className={`flex flex-1 inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 justify-center text-sm font-semibold transition ${activeTab === tab
                        ? "border-blue-600 bg-blue-50 text-blue-700"
                        : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                        }`}
                    id={`employee-detail-tab-${tab}`}
                    key={tab}
                    onClick={() => onChange(tab)}
                    role="tab"
                    type="button"
                >
                    {tabIcons[tab]}
                    <span className="text-sm hidden md:block">{labels[tab]}</span>
                </button>
            ))}
        </div>
    );
}
