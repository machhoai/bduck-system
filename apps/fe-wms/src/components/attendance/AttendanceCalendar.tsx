"use client";

import type { AttendanceLog } from "@bduck/shared-types";
import { motion } from "framer-motion";
import { CalendarCheck, Inbox } from "lucide-react";
import {
    buildSuccessLogMap,
    formatCheckInTime,
    type AttendanceDay,
    type AttendanceEmployeeRow,
} from "@/utils/attendance";

interface AttendanceCalendarProps {
    labels: Record<string, string>;
    days: AttendanceDay[];
    rows: AttendanceEmployeeRow[];
    logs: AttendanceLog[];
    loading: boolean;
}

export function AttendanceCalendar({
    labels,
    days,
    rows,
    logs,
    loading,
}: AttendanceCalendarProps) {
    const successMap = buildSuccessLogMap(logs);

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]"
        >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[#257a3e1a] text-[#257a3e]">
                        <CalendarCheck size={17} />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                            {labels.calendar}
                        </h2>
                        <p className="text-xs text-[var(--color-text-muted)]">
                            {labels.blankMeansNoCheckIn}
                        </p>
                    </div>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                    {rows.length} {labels.employees}
                </span>
            </div>

            {rows.length === 0 ? (
                <div className="flex min-h-64 flex-col items-center justify-center gap-2 p-8 text-center">
                    <Inbox size={28} className="text-[var(--color-text-muted)]" />
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {labels.noAttendanceData}
                    </p>
                    <p className="max-w-72 text-xs text-[var(--color-text-muted)]">
                        {labels.noAttendanceDataHint}
                    </p>
                </div>
            ) : (
                <div className="max-h-[calc(100vh-290px)] min-h-64 overflow-auto">
                    <table className="min-w-full border-separate border-spacing-0 text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                <th className="sticky left-0 z-20 w-56 min-w-56 border-b border-r border-[var(--color-border-soft)] bg-white px-3 py-3 text-left text-xs font-semibold text-[var(--color-text-muted)]">
                                    {labels.employee}
                                </th>
                                {days.map((day) => (
                                    <th
                                        key={day.key}
                                        className={`min-w-16 border-b border-r border-[var(--color-border-soft)] px-2 py-2 text-center text-xs font-semibold ${day.isSunday
                                            ? "bg-[#b4231808] text-[#b42318]"
                                            : day.isSaturday
                                                ? "bg-[#f59e0b0d] text-[#9a5b00]"
                                                : "bg-white text-[var(--color-text-secondary)]"
                                            }`}
                                    >
                                        <span className="block">{day.weekday}</span>
                                        <span className="block text-sm text-[var(--color-text-primary)]">
                                            {day.label}
                                        </span>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => (
                                <tr
                                    key={row.profile.id}
                                    className={loading ? "opacity-60" : undefined}
                                >
                                    <td className="sticky left-0 z-[5] border-b border-r border-[var(--color-border-soft)] bg-white px-3 py-3">
                                        <div className="min-w-0">
                                            <p className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                                                {row.profile.full_name}
                                            </p>
                                            <p className="truncate text-micro text-[var(--color-text-muted)]">
                                                {row.profile.employee_code} ·{" "}
                                                {row.warehouse?.name || labels.unknownWarehouse}
                                            </p>
                                        </div>
                                    </td>
                                    {days.map((day) => {
                                        const log = successMap.get(`${row.user.id}:${day.key}`);
                                        return (
                                            <td
                                                key={`${row.profile.id}-${day.key}`}
                                                className={`h-11 border-b border-r border-[var(--color-border-soft)] px-2 text-center tabular-nums ${day.isSunday
                                                    ? "bg-[#b4231805]"
                                                    : day.isSaturday
                                                        ? "bg-[#f59e0b08]"
                                                        : index % 2 === 0
                                                            ? "bg-white"
                                                            : "bg-[var(--color-surface-card)]"
                                                    } ${day.isFuture ? "opacity-45" : ""}`}
                                            >
                                                {log ? (
                                                    <span className="inline-flex rounded-full bg-[#257a3e12] px-2 py-1 text-xs font-semibold text-[#257a3e]">
                                                        {formatCheckInTime(log.check_in_at)}
                                                    </span>
                                                ) : null}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </motion.section>
    );
}
