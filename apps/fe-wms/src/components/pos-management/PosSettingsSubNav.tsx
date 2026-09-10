"use client";

import { Gift, PackageSearch, Printer, QrCode, UtensilsCrossed } from "lucide-react";

import { usePosManagementCopy } from "./usePosManagementCopy";

export type SettingsSubTab =
  | "receipt"
  | "ticket"
  | "lucky-draw"
  | "products"
  | "payment";

interface PosSettingsSubNavProps {
  activeSubTab: SettingsSubTab;
  onSelect: (subTab: SettingsSubTab) => void;
}

export function PosSettingsSubNav({
  activeSubTab,
  onSelect,
}: PosSettingsSubNavProps) {
  const copy = usePosManagementCopy();

  const subTabs: Array<{
    id: SettingsSubTab;
    label: string;
    icon: typeof Printer;
  }> = [
    { id: "receipt", label: copy.subTabReceipt, icon: Printer },
    { id: "ticket", label: copy.subTabTicket, icon: UtensilsCrossed },
    { id: "lucky-draw", label: copy.subTabLuckyDraw, icon: Gift },
    { id: "products", label: copy.subTabProducts, icon: PackageSearch },
    { id: "payment", label: copy.subTabPayment, icon: QrCode },
  ];

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b border-slate-100 pb-3">
      {subTabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeSubTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab.id)}
            className={`flex h-7 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all ${
              isActive
                ? "bg-amber-50 text-amber-900 border border-amber-200/80 shadow-2xs"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
            }`}
          >
            <Icon size={14} className={isActive ? "text-amber-600" : "text-slate-400"} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
