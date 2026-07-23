"use client";

import type { Warehouse } from "@bduck/shared-types";
import { CalendarDays, CalendarRange, Search } from "lucide-react";
import type { ReactNode } from "react";
import type { AttendanceRangeMode } from "@/utils/attendance";
import type { AttendanceEmployeeRow } from "@/utils/attendance";

interface TimeAttendanceFiltersProps {
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

export function TimeAttendanceFilters({
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
}: TimeAttendanceFiltersProps) {
    return (
        <div className="flex flex-col gap-3 rounded-[28px] border border-white/80 bg-white p-3 shadow-sm lg:rounded-full lg:border-[var(--color-border-soft)] lg:bg-[var(--color-surface-elevated)] lg:p-2 lg:shadow-none xl:flex-row xl:items-center xl:justify-between">
            <div className="hidden lg:flex items-center gap-1 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-1">
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

            <div className="grid gap-2 sm:grid-cols-2 xl:flex xl:items-center w-full lg:w-auto">
                {/* On mobile, only display the month selector. On desktop, toggle based on current mode */}
                <div className="block lg:hidden w-full">
                    <input
                        type="month"
                        value={month}
                        onClick={(e) => typeof e.currentTarget.showPicker === "function" && e.currentTarget.showPicker()}
                        onChange={(event) => onMonthChange(event.target.value)}
                        className="h-11 w-full min-w-0 rounded-2xl border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] cursor-pointer"
                    />
                </div>

                <div className="hidden lg:block">
                    {mode === "month" ? (
                        <input
                            type="month"
                            value={month}
                            onClick={(e) => typeof e.currentTarget.showPicker === "function" && e.currentTarget.showPicker()}
                            onChange={(event) => onMonthChange(event.target.value)}
                            className="h-10 min-w-44 rounded-full border border-[var(--color-border-subtle)] bg-white px-3 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] cursor-pointer"
                        />
                    ) : (
                        <input
                            type="date"
                            value={weekStart}
                            onClick={(e) => typeof e.currentTarget.showPicker === "function" && e.currentTarget.showPicker()}
                            onChange={(event) => onWeekStartChange(event.target.value)}
                            className="h-10 min-w-44 rounded-full border border-[var(--color-border-subtle)] bg-white px-3 text-xs text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] cursor-pointer"
                        />
                    )}
                </div>

                {canViewAttendance && (
                    <>
                        <select
                            value={selectedWarehouseId}
                            onChange={(event) => onWarehouseChange(event.target.value)}
                            className="h-11 min-w-0 rounded-2xl border border-[var(--color-border-subtle)] bg-white px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] lg:h-10 lg:min-w-44 lg:rounded-full"
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
                                className="h-11 w-full min-w-0 rounded-2xl border border-[var(--color-border-subtle)] bg-white pl-8 pr-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)] lg:h-10 lg:min-w-52 lg:rounded-full"
                            >
                                <option value="ALL">{labels.allEmployees}</option>
                                {employeeRows.map((row) => (
                                    <option key={row.profile.id} value={row.user.id}>
                                        {row.profile.full_name}
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
    icon: ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`inline-flex h-9 min-w-0 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition-all active:scale-95 lg:h-8 lg:min-w-24 lg:rounded-full ${active
                ? "bg-[var(--color-brand-primary)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-text-primary)]"
                }`}
        >
            {icon}
            <span>{label}</span>
        </button>
    );
}
