"use client";

import {
  formatContractDisplayDate,
  type EmployeeContract,
} from "@bduck/shared-types";
import { CalendarRange, Link2 } from "lucide-react";

import { resolveContractUiStatus } from "./employeeContractUiPolicy";
import type { EmployeeContractLabels } from "./employeeContractUiTypes";

interface EmployeeContractTimelineProps {
  contracts: EmployeeContract[];
  selectedId: string | null;
  labels: EmployeeContractLabels;
  onSelect: (contract: EmployeeContract) => void;
}

const statusTone = {
  UPCOMING: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-emerald-50 text-emerald-700",
  EXPIRED: "bg-slate-100 text-slate-600",
  TERMINATED: "bg-amber-50 text-amber-700",
  CANCELLED: "bg-red-50 text-red-700",
} as const;

export function EmployeeContractTimeline({
  contracts,
  selectedId,
  labels,
  onSelect,
}: EmployeeContractTimelineProps) {
  return (
    <section>
      <h5 className="mb-3 text-xs font-semibold">{labels.timeline.title}</h5>
      <ol className="relative ml-2 border-l border-[var(--color-border-subtle)]">
        {contracts.map((contract) => {
          const status = resolveContractUiStatus(contract);
          const selected = selectedId === contract.id;
          return (
            <li key={contract.id} className="relative pb-3 pl-5 last:pb-0">
              <span className="absolute -left-1.5 top-4 h-3 w-3 rounded-full border-2 border-white bg-[var(--color-brand-primary)]" />
              <button
                type="button"
                onClick={() => onSelect(contract)}
                className={`w-full rounded-xl border p-3 text-left transition-colors ${
                  selected
                    ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                    : "border-[var(--color-border-subtle)] bg-white hover:bg-[var(--color-surface-card)]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">
                      {contract.contract_number}
                    </p>
                    <p className="mt-0.5 text-xxs text-[var(--color-text-muted)]">
                      {labels.types[contract.contract_type]}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xxs font-semibold ${statusTone[status]}`}
                  >
                    {labels.statuses[status]}
                  </span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 text-xxs text-[var(--color-text-secondary)]">
                  <CalendarRange size={12} />
                  <span>
                    {formatContractDisplayDate(contract.start_date)} —{" "}
                    {contract.end_date
                      ? formatContractDisplayDate(contract.end_date)
                      : labels.form.noEndDate}
                  </span>
                </div>
                {contract.renewed_from_contract_id ? (
                  <p className="mt-1.5 flex items-center gap-1 text-xxs text-[var(--color-text-muted)]">
                    <Link2 size={11} />
                    {labels.timeline.renewedFrom}
                  </p>
                ) : null}
                <p className="mt-1 text-xxs text-[var(--color-text-muted)]">
                  {labels.timeline.revision} {contract.revision}
                </p>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
