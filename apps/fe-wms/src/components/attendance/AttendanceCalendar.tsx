"use client";

import type { AttendanceLog } from "@bduck/shared-types";
import { motion } from "framer-motion";
import { CalendarCheck, Inbox } from "lucide-react";
import {
    buildSuccessLogMap,
    formatCheckInTime,
    getTodayKey,
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

const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

const getAvatarBg = (name: string) => {
    const colors = [
        "bg-[#0066cc10] text-[#0066cc]",
        "bg-[#257a3e10] text-[#257a3e]",
        "bg-[#93600010] text-[#936000]",
        "bg-[#7928ca10] text-[#7928ca]",
        "bg-[#ff007f10] text-[#ff007f]",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

const formatMobileDay = (day: AttendanceDay) =>
    day.date.toLocaleDateString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        timeZone: "Asia/Ho_Chi_Minh",
    });

export function AttendanceCalendar({
    labels,
    days,
    rows,
    logs,
    loading,
}: AttendanceCalendarProps) {
    const successMap = buildSuccessLogMap(logs);
    const todayKey = getTodayKey();

    const isVi = labels.allEmployees?.toLowerCase().includes("nhân viên") || labels.calendar?.toLowerCase().includes("lịch");
    const txtCheckedIn = isVi ? "Đã check-in" : "已打卡";
    const txtWaiting = isVi ? "Chờ check-in" : "等待打卡";
    const txtNoLog = isVi ? "Vắng / Không log" : "无记录";

    const checkedCount = logs.filter((log) => log.status === "SUCCESS").length;

    return (
        <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-sm lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-soft)] lg:bg-[var(--color-surface-elevated)] lg:shadow-none"
        >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-soft)] bg-white p-4 lg:bg-[var(--color-surface-card)]">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#257a3e10] text-[#257a3e]">
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

                <div className="flex items-center gap-4">
                    {/* Visual Legend */}
                    <div className="hidden items-center gap-4 md:flex">
                        <div className="flex items-center gap-1.5 text-xxs text-[var(--color-text-secondary)] font-medium">
                            <span className="h-2 w-2 rounded-full bg-[#257a3e]" />
                            <span>{txtCheckedIn}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xxs text-[var(--color-text-secondary)] font-medium">
                            <span className="h-2 w-2 rounded-full border border-dashed border-[var(--color-brand-primary)] animate-pulse" />
                            <span>{txtWaiting}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xxs text-[var(--color-text-secondary)] font-medium">
                            <span className="text-slate-300 font-bold">•</span>
                            <span>{txtNoLog}</span>
                        </div>
                    </div>

                    <span className="rounded-full bg-white border border-[var(--color-border-subtle)] px-2.5 py-0.5 text-xxs font-semibold text-[var(--color-text-secondary)] shadow-sm">
                        {rows.length} {labels.employees}
                    </span>
                </div>
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
                <>
                <div className="space-y-3 bg-[#f8fafc] p-3 md:hidden">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-2xl bg-white p-3 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                                {txtCheckedIn}
                            </p>
                            <p className="mt-1 text-2xl font-semibold tabular-nums text-[#257a3e]">
                                {checkedCount}
                            </p>
                        </div>
                        <div className="rounded-2xl bg-white p-3 shadow-sm">
                            <p className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                                {labels.employees}
                            </p>
                            <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-text-primary)]">
                                {rows.length}
                            </p>
                        </div>
                    </div>

                    <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 scrollbar-thin">
                        {days.map((day) => {
                            const isToday = day.key === todayKey;
                            return (
                                <div
                                    key={day.key}
                                    className={`flex min-w-14 flex-col items-center rounded-2xl border px-3 py-2 ${isToday
                                        ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary)] text-white"
                                        : day.isSunday
                                            ? "border-[#b4231815] bg-[#b4231808] text-[#b42318]"
                                            : "border-white bg-white text-[var(--color-text-secondary)]"
                                        }`}
                                >
                                    <span className="text-[10px] font-semibold uppercase opacity-80">
                                        {day.weekday}
                                    </span>
                                    <span className="text-base font-semibold tabular-nums">
                                        {day.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="space-y-3">
                        {rows.map((row) => {
                            const todayLog = successMap.get(`${row.user.id}:${todayKey}`);
                            return (
                                <article
                                    key={row.profile.id}
                                    className="overflow-hidden rounded-[24px] bg-white shadow-sm"
                                >
                                    <div className="flex items-center justify-between gap-3 p-3">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-bold ${getAvatarBg(row.profile.full_name)}`}>
                                                {getInitials(row.profile.full_name)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                                    {row.profile.full_name}
                                                </p>
                                                <p className="truncate text-xs text-[var(--color-text-muted)]">
                                                    {row.profile.employee_code} ·{" "}
                                                    {row.warehouse?.name || labels.unknownWarehouse}
                                                </p>
                                            </div>
                                        </div>
                                        {todayLog ? (
                                            <span className="shrink-0 rounded-full bg-[#257a3e10] px-2.5 py-1 text-xs font-semibold tabular-nums text-[#257a3e]">
                                                {formatCheckInTime(todayLog.check_in_at)}
                                            </span>
                                        ) : (
                                            <span className="shrink-0 rounded-full bg-[var(--color-brand-primary-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--color-brand-primary)]">
                                                {txtWaiting}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex gap-2 overflow-x-auto border-t border-[var(--color-border-soft)] bg-[#fafafa] px-3 py-3 scrollbar-thin">
                                        {days.map((day) => {
                                            const log = successMap.get(`${row.user.id}:${day.key}`);
                                            return (
                                                <MobileAttendanceDayCell
                                                    key={`${row.profile.id}-${day.key}`}
                                                    day={day}
                                                    isToday={day.key === todayKey}
                                                    logTime={log ? formatCheckInTime(log.check_in_at) : ""}
                                                    waitingLabel={txtWaiting}
                                                    emptyLabel={txtNoLog}
                                                />
                                            );
                                        })}
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </div>

                <div className="hidden max-h-[calc(100vh-290px)] min-h-64 overflow-auto scrollbar-thin md:block">
                    <table className="min-w-full border-separate border-spacing-0 text-sm">
                        <thead className="sticky top-0 z-10">
                            <tr>
                                <th className="sticky left-0 z-20 w-60 min-w-60 border-b border-r border-[var(--color-border-soft)] bg-white px-3 py-3 text-left text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                    {labels.employee}
                                </th>
                                {days.map((day) => {
                                    const isToday = day.key === todayKey;
                                    return (
                                        <th
                                            key={day.key}
                                            className={`min-w-16 border-b border-r border-[var(--color-border-soft)] px-2 py-2 text-center text-xs font-semibold ${
                                                isToday
                                                    ? "bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]"
                                                    : day.isSunday
                                                        ? "bg-[#b4231805] text-[#b42318]"
                                                        : day.isSaturday
                                                            ? "bg-[#f59e0b0d] text-[#9a5b00]"
                                                            : "bg-white text-[var(--color-text-secondary)]"
                                            }`}
                                        >
                                            <span className="block text-[9px] uppercase tracking-wider opacity-85">{day.weekday}</span>
                                            <span className={`inline-block mt-0.5 text-xs font-bold px-1.5 py-0.5 rounded-full ${isToday ? "bg-[var(--color-brand-primary)] text-white" : ""}`}>
                                                {day.label}
                                            </span>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row, index) => (
                                <tr
                                    key={row.profile.id}
                                    className={`${loading ? "opacity-60" : ""} hover:bg-slate-50/50 transition-colors`}
                                >
                                    <td className="sticky left-0 z-[5] border-b border-r border-[var(--color-border-soft)] bg-white px-3 py-2 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.05)]">
                                        <div className="flex items-center gap-2">
                                            <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xxs font-bold ${getAvatarBg(row.profile.full_name)}`}>
                                                {getInitials(row.profile.full_name)}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-semibold text-[var(--color-text-primary)]">
                                                    {row.profile.full_name}
                                                </p>
                                                <p className="truncate text-micro text-[var(--color-text-muted)]">
                                                    {row.profile.employee_code} ·{" "}
                                                    {row.warehouse?.name || labels.unknownWarehouse}
                                                </p>
                                            </div>
                                        </div>
                                    </td>
                                    {days.map((day) => {
                                        const log = successMap.get(`${row.user.id}:${day.key}`);
                                        const isToday = day.key === todayKey;
                                        return (
                                            <td
                                                key={`${row.profile.id}-${day.key}`}
                                                className={`h-11 border-b border-r border-[var(--color-border-soft)] px-1.5 text-center tabular-nums transition-colors ${
                                                    isToday
                                                        ? "bg-[#0066cc05]"
                                                        : day.isSunday
                                                            ? "bg-[#b4231802]"
                                                            : day.isSaturday
                                                                ? "bg-[#f59e0b04]"
                                                                : index % 2 === 0
                                                                    ? "bg-white"
                                                                    : "bg-[var(--color-surface-card)]"
                                                } ${day.isFuture ? "opacity-45" : ""}`}
                                            >
                                                {log ? (
                                                    <div className="flex items-center justify-center">
                                                        <span className="inline-flex items-center gap-1.5 rounded-md bg-[#257a3e10] border border-[#257a3e20] px-2 py-0.5 text-micro font-semibold text-[#257a3e] transition-transform hover:scale-105 hover:bg-[#257a3e20]">
                                                            <span className="h-1.5 w-1.5 rounded-full bg-[#257a3e]" />
                                                            {formatCheckInTime(log.check_in_at)}
                                                        </span>
                                                    </div>
                                                ) : isToday ? (
                                                    <div className="flex items-center justify-center">
                                                        <span className="inline-flex items-center justify-center rounded-md border border-dashed border-[var(--color-brand-primary)] px-2 py-0.5 text-micro font-medium text-[var(--color-brand-primary)] animate-pulse">
                                                            {isVi ? "Chờ..." : "等待..."}
                                                        </span>
                                                    </div>
                                                ) : !day.isFuture ? (
                                                    <span className="text-slate-300 font-bold select-none text-xs">•</span>
                                                ) : null}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                </>
            )}
        </motion.section>
    );
}

function MobileAttendanceDayCell({
    day,
    isToday,
    logTime,
    waitingLabel,
    emptyLabel,
}: {
    day: AttendanceDay;
    isToday: boolean;
    logTime: string;
    waitingLabel: string;
    emptyLabel: string;
}) {
    if (logTime) {
        return (
            <div className="flex min-w-[76px] flex-col rounded-2xl border border-[#257a3e20] bg-[#257a3e08] p-2">
                <span className="text-[10px] font-semibold text-[#257a3e]">
                    {formatMobileDay(day)}
                </span>
                <span className="mt-1 text-sm font-semibold tabular-nums text-[#257a3e]">
                    {logTime}
                </span>
            </div>
        );
    }

    if (isToday) {
        return (
            <div className="flex min-w-[76px] flex-col rounded-2xl border border-dashed border-[var(--color-brand-primary)] bg-white p-2">
                <span className="text-[10px] font-semibold text-[var(--color-brand-primary)]">
                    {formatMobileDay(day)}
                </span>
                <span className="mt-1 truncate text-xs font-semibold text-[var(--color-brand-primary)]">
                    {waitingLabel}
                </span>
            </div>
        );
    }

    return (
        <div className={`flex min-w-[76px] flex-col rounded-2xl border bg-white p-2 ${day.isFuture ? "border-transparent opacity-45" : "border-[var(--color-border-soft)]"}`}>
            <span className="text-[10px] font-semibold text-[var(--color-text-muted)]">
                {formatMobileDay(day)}
            </span>
            <span className="mt-1 truncate text-xs text-[var(--color-text-muted)]">
                {day.isFuture ? "" : emptyLabel}
            </span>
        </div>
    );
}
