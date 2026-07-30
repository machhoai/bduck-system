"use client";

import {
  formatContractDisplayDate,
  type EmployeeContractExpiryView,
} from "@bduck/shared-types";
import { motion } from "framer-motion";
import { CalendarClock, ChevronRight, X } from "lucide-react";

import { Skeleton } from "@/components/ui/Skeleton";
import type { EmployeeContractLabels } from "@/lib/i18n/employeeContractTranslations";

export function EmployeeContractExpiryPanel({
  isOpen,
  onClose,
  contracts,
  profiles,
  labels,
  isLoading,
  error,
  onOpenEmployee,
}: {
  isOpen: boolean;
  onClose: () => void;
  contracts: EmployeeContractExpiryView[];
  profiles: Map<string, { full_name: string; employee_code: string }>;
  labels: EmployeeContractLabels;
  isLoading: boolean;
  error: string | null;
  onOpenEmployee: (profileId: string) => void;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-2xl"
      >
        {/* Modal Header */}
        <header className="flex items-center justify-between border-b border-[var(--color-border-soft)] bg-white px-5 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <CalendarClock size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[var(--color-text-primary)]">
                  {labels.expiry.title}
                </h2>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-xxs font-bold text-amber-800">
                  {contracts.length}
                </span>
              </div>
              <p className="text-xs text-[var(--color-text-muted)]">
                {labels.expiry.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            aria-label={labels.actions.close}
          >
            <X size={18} />
          </button>
        </header>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-2.5">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-[#b42318]">
              {error}
            </div>
          ) : contracts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                <CalendarClock size={22} />
              </div>
              <p className="mt-3 text-xs font-medium text-[var(--color-text-muted)]">
                {labels.expiry.empty}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {contracts.map((contract) => {
                const profile = profiles.get(contract.employee_profile_id);
                const name =
                  contract.employee_name || profile?.full_name || "---";
                const code =
                  contract.employee_code || profile?.employee_code || "";
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
                    onClick={() => {
                      onOpenEmployee(contract.employee_profile_id);
                      onClose();
                    }}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-amber-200/80 bg-white p-3 text-left shadow-xs transition-all hover:border-amber-400 hover:bg-amber-50/40 active:scale-[0.99] cursor-pointer"
                    aria-label={labels.expiry.openEmployee}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-bold text-[var(--color-text-primary)]">
                          {name}
                        </p>
                        {code && (
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-xxs font-semibold text-slate-600">
                            {code}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xxs text-[var(--color-text-muted)]">
                        {labels.fields.contractNumber}: {contract.contract_number || "---"}
                      </p>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xxs font-bold text-amber-800">
                          {remaining}
                        </span>
                        <p className="mt-0.5 text-micro text-[var(--color-text-muted)] tabular-nums">
                          {labels.expiry.endDate}: {formatContractDisplayDate(contract.end_date)}
                        </p>
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-slate-400 group-hover:text-amber-700"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}

