"use client";

import { LeaveRequestType } from "@bduck/shared-types";
import { Baby, CalendarClock, FileText, HeartPulse } from "lucide-react";

const requestTypes = [
  { key: "paidLeave", value: LeaveRequestType.PAID_ANNUAL, icon: CalendarClock, tone: "text-[#257a3e] bg-[#257a3e10]" },
  { key: "unpaidLeave", value: LeaveRequestType.UNPAID, icon: FileText, tone: "text-[#936000] bg-[#93600010]" },
  { key: "maternityLeave", value: LeaveRequestType.MATERNITY, icon: Baby, tone: "text-[#7928ca] bg-[#7928ca10]" },
  { key: "sickLeave", value: LeaveRequestType.SICK, icon: HeartPulse, tone: "text-[#b42318] bg-[#b4231810]" },
];

export function AdminRequestActions({
  labels,
  onSelect,
}: {
  labels: Record<string, string>;
  onSelect: (requestType: LeaveRequestType) => void;
}) {
  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {requestTypes.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelect(item.value)}
            className="flex min-h-24 items-center gap-3 rounded-2xl border border-[var(--color-border-soft)] bg-white p-3 text-left transition-all hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-surface-card)] active:scale-[0.98]"
          >
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.tone}`}
            >
              <Icon size={18} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-[var(--color-text-primary)]">
                {labels[item.key]}
              </span>
              <span className="mt-1 block text-xs text-[var(--color-text-muted)]">
                {labels.requestActionHint}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
