"use client";

import type { Warehouse } from "@bduck/shared-types";
import { CalendarDays, CalendarRange, Search } from "lucide-react";
import type { AttendanceRangeMode } from "@/utils/attendance";
import type { AttendanceEmployeeRow } from "@/utils/attendance";

interface AttendanceFiltersProps {
  labels: Record<string, string>;
  canViewAttendance: boolean;
  warehouses: Warehouse[];
  employeeRows: AttendanceEmployeeRow[];
  selectedWarehouseId: string;
  selectedUserId: string;
  mode: AttendanceRangeMode;
  month: string;
  weekStart: string;
  onWarehouseChange: (value: string) => void;
  onUserChange: (value: string) => void;
  onModeChange: (value: AttendanceRangeMode) => void;
  onMonthChange: (value: string) => void;
  onWeekStartChange: (value: string) => void;
}

export function AttendanceFilters({
  labels,
  canViewAttendance,
  warehouses,
  employeeRows,
  selectedWarehouseId,
  selectedUserId,
  mode,
  month,
  weekStart,
  onWarehouseChange,
  onUserChange,
  onModeChange,
  onMonthChange,
  onWeekStartChange,
}: AttendanceFiltersProps) {
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-1">
        <ModeButton
          active={mode === "week"}
          icon={<CalendarRange size={15} />}
          label={labels.week}
          onClick={() => onModeChange("week")}
        />
        <ModeButton
          active={mode === "month"}
          icon={<CalendarDays size={15} />}
          label={labels.month}
          onClick={() => onModeChange("month")}
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:flex lg:items-center">
        {mode === "month" ? (
          <input
            type="month"
            value={month}
            onChange={(event) => onMonthChange(event.target.value)}
            className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
          />
        ) : (
          <input
            type="date"
            value={weekStart}
            onChange={(event) => onWeekStartChange(event.target.value)}
            className="h-9 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
          />
        )}

        {canViewAttendance && (
          <>
            <select
              value={selectedWarehouseId}
              onChange={(event) => onWarehouseChange(event.target.value)}
              className="h-9 min-w-44 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
            >
              <option value="ALL">{labels.allWarehouses}</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name}
                </option>
              ))}
            </select>

            <div className="relative">
              <Search
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              <select
                value={selectedUserId}
                onChange={(event) => onUserChange(event.target.value)}
                className="h-9 min-w-52 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white pl-8 pr-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
              >
                <option value="ALL">{labels.allEmployees}</option>
                {employeeRows.map((row) => (
                  <option key={row.user.id} value={row.user.id}>
                    {row.user.full_name}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-8 min-w-24 items-center justify-center gap-2 rounded-full px-3 text-sm font-semibold transition-all active:scale-95 ${
        active
          ? "bg-[var(--color-brand-primary)] text-white"
          : "text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-text-primary)]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
