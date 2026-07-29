"use client";

import {
  formatContractDisplayDate,
  type EmployeeContractExpiryView,
} from "@bduck/shared-types";
import { CalendarClock, ChevronRight } from "lucide-react";

import { Skeleton } from "@/components/ui/Skeleton";
import type { EmployeeContractLabels } from "@/lib/i18n/employeeContractTranslations";

export function EmployeeContractExpiryPanel({
  contracts,
  profiles,
  labels,
  isLoading,
  error,
  onOpenEmployee,
}: {
  contracts: EmployeeContractExpiryView[];
  profiles: Map<string, { full_name: string; employee_code: string }>;
  labels: EmployeeContractLabels;
  isLoading: boolean;
  error: string | null;
  onOpenEmployee: (profileId: string) => void;
}) {
  if (isLoading) {
    return (
      <section className="rounded-2xl border border-[var(--color-border-subtle)] bg-white p-3">
        <Skeleton variant="text" className="h-5 w-48" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Skeleton key={index} className="h-20 rounded-2xl" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-amber-200/80 bg-amber-50/60 p-3 lg:rounded-[var(--radius-lg)]">
      <div className="flex items-start gap-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
          <CalendarClock size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
            {labels.expiry.title}
          </h2>
          <p className="text-xs text-[var(--color-text-secondary)]">
            {labels.expiry.subtitle}
          </p>
        </div>
        <span className="ml-auto rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold tabular-nums text-amber-800">
          {contracts.length}
        </span>
      </div>

      {error ? (
        <p className="mt-3 rounded-xl border border-red-200 bg-red-50 p-2.5 text-xs text-[#b42318]">
          {error}
        </p>
      ) : contracts.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-amber-200 bg-white/70 p-3 text-xs text-[var(--color-text-muted)]">
          {labels.expiry.empty}
        </p>
      ) : (
        <div className="mt-3 flex snap-x gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-3 lg:overflow-visible">
          {contracts.map((contract) => {
            const profile = profiles.get(contract.employee_profile_id);
            const name = contract.employee_name || profile?.full_name || "---";
            const code = contract.employee_code || profile?.employee_code || "";
            const remaining =
              contract.days_until_expiry === 0
                ? labels.expiry.expiresToday
                : labels.expiry.daysLeft.replace(
                    "{days}",
                    String(contract.days_until_expiry),
                  );
            return (
              <button
                key={contract.id}
                type="button"
                onClick={() => onOpenEmployee(contract.employee_profile_id)}
                className="min-w-[260px] snap-start rounded-2xl border border-amber-200/80 bg-white p-3 text-left shadow-xs transition active:scale-[0.98] lg:min-w-0"
                aria-label={labels.expiry.openEmployee}
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-[var(--color-text-primary)]">
                      {name}
                    </p>
                    <p className="truncate text-[10px] text-[var(--color-text-muted)]">
                      {[code, contract.contract_number]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <ChevronRight size={15} className="shrink-0 text-amber-700" />
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                  <span className="font-semibold text-amber-800">
                    {remaining}
                  </span>
                  <span className="tabular-nums text-[var(--color-text-secondary)]">
                    {formatContractDisplayDate(contract.end_date)}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
