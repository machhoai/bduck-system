"use client";

import {
  LeaveRequestStatus,
  LeaveRequestType,
  type LeaveRequestAdminView,
} from "@bduck/shared-types";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "./AdminOverviewParts";
import { LeaveApprovalTimeline } from "./LeaveApprovalTimeline";

const statuses = Object.values(LeaveRequestStatus);
const types = Object.values(LeaveRequestType);

export function CompanyLeaveRequests({
  labels,
  items,
  loading,
  error,
}: {
  labels: Record<string, string>;
  items: LeaveRequestAdminView[];
  loading: boolean;
  error: string | null;
}) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !term ||
        item.employee_name.toLocaleLowerCase().includes(term) ||
        item.employee_code.toLocaleLowerCase().includes(term);
      return (
        matchesSearch &&
        (status === "ALL" || item.request.status === status) &&
        (type === "ALL" || item.request.request_type === type)
      );
    });
  }, [items, search, status, type]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[0, 1, 2].map((item) => (
          <div
            key={item}
            className="h-24 animate-pulse rounded-2xl bg-[var(--color-surface-card)]"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-2xl bg-red-50 p-3 text-xs text-red-700">{error}</p>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_0.7fr_0.7fr]">
        <label className="relative">
          <Search
            size={14}
            className="absolute left-3 top-3.5 text-[var(--color-text-muted)]"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={labels.searchEmployeeLeave}
            className="h-11 w-full rounded-xl border border-[var(--color-border-soft)] pl-9 pr-3 text-xs outline-none focus:border-[var(--color-brand-primary)]"
          />
        </label>
        <select
          value={status}
          aria-label={labels.filterLeaveStatus}
          onChange={(event) => setStatus(event.target.value)}
          className="h-11 rounded-xl border border-[var(--color-border-soft)] bg-white px-3 text-xs"
        >
          <option value="ALL">{labels.allStatuses}</option>
          {statuses.map((value) => (
            <option key={value} value={value}>
              {labels[`leaveStatus${value}`] || value}
            </option>
          ))}
        </select>
        <select
          value={type}
          aria-label={labels.filterLeaveType}
          onChange={(event) => setType(event.target.value)}
          className="h-11 rounded-xl border border-[var(--color-border-soft)] bg-white px-3 text-xs"
        >
          <option value="ALL">{labels.allLeaveTypes}</option>
          {types.map((value) => (
            <option key={value} value={value}>
              {labels[`leaveType${value}`] || value}
            </option>
          ))}
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title={labels.noCompanyLeaveRequests}
          hint={labels.noCompanyLeaveRequestsHint}
        />
      ) : (
        filtered.map((item) => {
          const expanded = expandedId === item.request.id;
          return (
            <article
              key={item.request.id}
              className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-3"
            >
              <button
                type="button"
                onClick={() =>
                  setExpandedId(expanded ? null : item.request.id)
                }
                className="flex w-full items-start gap-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                    {item.employee_name} · {item.employee_code}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                    {item.request.days.map((day) => day.date).join(", ")}
                  </p>
                  <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                    {item.request.request_type} · {item.request.status}
                  </p>
                </div>
                <span className="text-sm font-bold text-[var(--color-brand-primary)]">
                  {item.request.total_units}
                </span>
                {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expanded && (
                <div className="mt-3 border-t border-[var(--color-border-soft)] pt-3">
                  <p className="mb-2 text-xs text-[var(--color-text-secondary)]">
                    {item.request.reason}
                  </p>
                  <LeaveApprovalTimeline
                    labels={labels}
                    tasks={item.approval_tasks}
                  />
                </div>
              )}
            </article>
          );
        })
      )}
    </div>
  );
}
