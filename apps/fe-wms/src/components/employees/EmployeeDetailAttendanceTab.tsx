"use client";

import type { EmployeeProfile } from "@bduck/shared-types";
import {
    AttendanceLogStatus,
    AttendanceWorkMode,
} from "@bduck/shared-types";
import {
    AlertCircle,
    Briefcase,
    Building2,
    CalendarCheck2,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Laptop,
    List,
    XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";

import { useAttendanceLogs } from "@/hooks/useAttendanceRecords";
import {
    buildAttendanceDays,
    formatCheckInTime,
    formatMonthLabel,
    getCurrentMonthKey,
    getNextMonthKey,
    getPrevMonthKey,
} from "@/utils/attendance";

import type { EmployeeDetailTabsLabels } from "./employeeDetailTabsTranslations";

type EmployeeDetailAttendanceTabProps = {
    profile: EmployeeProfile;
    labels: EmployeeDetailTabsLabels;
    isVietnamese: boolean;
};

type ViewMode = "grid" | "list" | "split";

export function EmployeeDetailAttendanceTab({
    profile,
    labels,
    isVietnamese,
}: EmployeeDetailAttendanceTabProps) {
    const [monthKey, setMonthKey] = useState(getCurrentMonthKey);
    const [viewMode, setViewMode] = useState<ViewMode>("split");
    const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);

    const days = useMemo(
        () => buildAttendanceDays("month", monthKey),
        [monthKey],
    );
    const { logs, loading } = useAttendanceLogs(
        days[0]?.key ?? "",
        days[days.length - 1]?.key ?? "",
    );
    const employeeLogs = useMemo(
        () =>
            logs.filter(
                (log) =>
                    log.employee_profile_id === profile.id ||
                    (profile.user_id && log.user_id === profile.user_id),
            ),
        [logs, profile.id, profile.user_id],
    );
    const logByDate = useMemo(() => {
        const grouped = new Map<string, (typeof employeeLogs)[number]>();
        employeeLogs.forEach((log) => {
            const current = grouped.get(log.attendance_date);
            if (!current || log.status === AttendanceLogStatus.SUCCESS) {
                grouped.set(log.attendance_date, log);
            }
        });
        return grouped;
    }, [employeeLogs]);

    const successCount = employeeLogs.filter(
        (log) => log.status === AttendanceLogStatus.SUCCESS,
    ).length;
    const rejectedCount = employeeLogs.filter(
        (log) => log.status === AttendanceLogStatus.REJECTED,
    ).length;
    const missingCount = days.filter(
        (day) =>
            !day.isFuture &&
            !day.isSaturday &&
            !day.isSunday &&
            logByDate.get(day.key)?.status !== AttendanceLogStatus.SUCCESS,
    ).length;

    const monthLabel = formatMonthLabel(monthKey, isVietnamese);

    const filteredDays = useMemo(() => {
        if (!selectedDayKey) return days;
        return days.filter((d) => d.key === selectedDayKey);
    }, [days, selectedDayKey]);

    return (
        <section
            aria-labelledby="employee-detail-tab-attendance"
            className="space-y-4"
            id="employee-detail-panel-attendance"
            role="tabpanel"
        >
            {/* Header & View Controls */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h3 className="text-base font-bold text-slate-900">
                        {labels.attendance.title}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                        {labels.attendance.subtitle}
                    </p>
                </div>

                <div className="flex flex-col md:flex-row items-center gap-2">
                    {/* Month Switcher */}
                    <div className="flex flex-1 w-full md:w-auto items-center rounded-xl border border-slate-200 bg-white p-1 shadow-2xs">
                        <MonthButton
                            label={labels.attendance.previousMonth}
                            onClick={() => {
                                setMonthKey(getPrevMonthKey(monthKey));
                                setSelectedDayKey(null);
                            }}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </MonthButton>
                        <span className="min-w-28 flex-1 px-2 text-center text-xs font-semibold tabular-nums text-slate-700">
                            {monthLabel}
                        </span>
                        <MonthButton
                            label={labels.attendance.nextMonth}
                            onClick={() => {
                                setMonthKey(getNextMonthKey(monthKey));
                                setSelectedDayKey(null);
                            }}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </MonthButton>
                    </div>

                    {/* View Switcher Segmented Control */}
                    <div className="flex flex-1 w-full md:w-auto items-center rounded-xl border border-slate-200 bg-slate-100/80 p-0.5 shadow-2xs">
                        <button
                            type="button"
                            onClick={() => setViewMode("grid")}
                            className={`flex flex-1 items-center gap-1 rounded-sm px-2.5 py-2 text-xs font-medium transition ${viewMode === "grid"
                                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                                : "text-slate-500 hover:text-slate-800"
                                }`}
                            title={isVietnamese ? "Lịch tháng" : "月历"}
                        >
                            <CalendarDays className="size-4" />
                            <span className="">
                                {isVietnamese ? "Lịch" : "日历"}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("list")}
                            className={`flex flex-1 items-center gap-1 rounded-sm px-2.5 py-2 text-xs font-medium transition ${viewMode === "list"
                                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                                : "text-slate-500 hover:text-slate-800"
                                }`}
                            title={isVietnamese ? "Danh sách" : "列表"}
                        >
                            <List className="size-4" />
                            <span className="">
                                {isVietnamese ? "Danh sách" : "列表"}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("split")}
                            className={`flex flex-1 items-center gap-1 rounded-sm px-2.5 py-2 text-xs font-medium transition ${viewMode === "split"
                                ? "bg-white text-slate-900 shadow-2xs font-semibold"
                                : "text-slate-500 hover:text-slate-800"
                                }`}
                            title={isVietnamese ? "Tất cả" : "全部"}
                        >
                            <span className="text-xxs font-bold">ALL</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Summary Cards Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <SummaryCard
                    icon={<CalendarCheck2 className="size-4" />}
                    label={labels.attendance.successfulDays}
                    tone="green"
                    value={successCount}
                />
                <SummaryCard
                    icon={<Clock3 className="size-4" />}
                    label={labels.attendance.missingDays}
                    tone="amber"
                    value={missingCount}
                />
                {rejectedCount > 0 ? (
                    <SummaryCard
                        icon={<XCircle className="size-4" />}
                        label={labels.attendance.rejectedAttempts}
                        tone="red"
                        value={rejectedCount}
                    />
                ) : (
                    <SummaryCard
                        icon={<CalendarDays className="size-4" />}
                        label={isVietnamese ? "Tổng ngày" : "总天数"}
                        tone="slate"
                        value={days.length}
                    />
                )}
            </div>

            {/* Main Section Content */}
            {loading ? (
                <AttendanceSkeleton viewMode={viewMode} />
            ) : (
                <div className="space-y-4">
                    {/* Monthly Calendar Heat-Grid */}
                    {(viewMode === "grid" || viewMode === "split") && (
                        <AttendanceCalendarGrid
                            days={days}
                            isVietnamese={isVietnamese}
                            labels={labels}
                            logByDate={logByDate}
                            onSelectDay={(key) =>
                                setSelectedDayKey((prev) => (prev === key ? null : key))
                            }
                            selectedDayKey={selectedDayKey}
                        />
                    )}

                    {/* Filter Indicator when day is selected */}
                    {selectedDayKey && (
                        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/80 px-3 py-2 text-xs text-blue-800">
                            <span>
                                {isVietnamese
                                    ? `Đang lọc ngày: ${selectedDayKey.split("-").reverse().join("/")}`
                                    : `正在筛选: ${selectedDayKey}`}
                            </span>
                            <button
                                className="font-semibold underline hover:text-blue-900"
                                onClick={() => setSelectedDayKey(null)}
                                type="button"
                            >
                                {isVietnamese ? "Xem tất cả" : "查看全部"}
                            </button>
                        </div>
                    )}

                    {/* Mobile-Native Daily Card List */}
                    {(viewMode === "list" || viewMode === "split") && (
                        <AttendanceDailyList
                            days={filteredDays}
                            isVietnamese={isVietnamese}
                            labels={labels}
                            logByDate={logByDate}
                        />
                    )}
                </div>
            )}
        </section>
    );
}

function AttendanceCalendarGrid({
    days,
    isVietnamese,
    labels,
    logByDate,
    onSelectDay,
    selectedDayKey,
}: {
    days: ReturnType<typeof buildAttendanceDays>;
    isVietnamese: boolean;
    labels: EmployeeDetailTabsLabels;
    logByDate: Map<string, any>;
    onSelectDay: (key: string) => void;
    selectedDayKey: string | null;
}) {
    const weekdayHeaders = isVietnamese
        ? ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
        : ["一", "二", "三", "四", "五", "六", "日"];

    const firstDay = days[0];
    const firstWeekday = firstDay ? (firstDay.date.getDay() + 6) % 7 : 0;
    const paddingCells = Array.from({ length: firstWeekday });

    return (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-2xs">
            <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                    {isVietnamese ? "Ma trận lịch tháng" : "月考勤矩阵"}
                </span>
                <div className="flex flex-wrap items-center gap-2 text-xxs font-medium text-slate-500">
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        {labels.attendance.success}
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        {labels.attendance.missing}
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-slate-300" />
                        {labels.attendance.weekend}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center">
                {weekdayHeaders.map((header, idx) => (
                    <div
                        className={`py-1 text-xxs font-bold uppercase tracking-wider ${idx >= 5 ? "text-amber-600/70" : "text-slate-400"
                            }`}
                        key={header}
                    >
                        {header}
                    </div>
                ))}

                {paddingCells.map((_, i) => (
                    <div className="h-10 rounded-lg bg-slate-50/40" key={`pad-${i}`} />
                ))}

                {days.map((day) => {
                    const log = logByDate.get(day.key);
                    const isSelected = selectedDayKey === day.key;

                    let bgStyle = "bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200/60";
                    let dotColor = "bg-transparent";

                    if (log?.status === AttendanceLogStatus.SUCCESS) {
                        bgStyle = "bg-emerald-50/80 hover:bg-emerald-100 text-emerald-900 border-emerald-200";
                        dotColor = "bg-emerald-500";
                    } else if (log?.status === AttendanceLogStatus.REJECTED) {
                        bgStyle = "bg-red-50/80 hover:bg-red-100 text-red-900 border-red-200";
                        dotColor = "bg-red-500";
                    } else if (day.isSaturday || day.isSunday) {
                        bgStyle = "bg-slate-100/50 hover:bg-slate-100 text-slate-400 border-transparent";
                        dotColor = "bg-slate-300";
                    } else if (!day.isFuture) {
                        bgStyle = "bg-amber-50/70 hover:bg-amber-100 text-amber-900 border-amber-200/80";
                        dotColor = "bg-amber-500";
                    } else {
                        bgStyle = "bg-white hover:bg-slate-50 text-slate-400 border-slate-100";
                    }

                    if (isSelected) {
                        bgStyle += " ring-2 ring-blue-500 ring-offset-1 z-10 font-bold";
                    }

                    const checkInTime = formatCheckInTime(log?.check_in_at);

                    return (
                        <button
                            className={`group relative flex h-10 flex-col items-center justify-between rounded-lg border p-1 transition-all ${bgStyle}`}
                            key={day.key}
                            onClick={() => onSelectDay(day.key)}
                            title={`${day.key}: ${log?.status ?? (day.isFuture ? "Tương lai" : "Chưa chấm")}`}
                            type="button"
                        >
                            <span className="text-xxs font-semibold tabular-nums">
                                {day.label}
                            </span>
                            {checkInTime ? (
                                <span className="text-[9px] font-semibold leading-none tabular-nums opacity-90">
                                    {checkInTime}
                                </span>
                            ) : (
                                <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function AttendanceDailyList({
    days,
    labels,
    logByDate,
}: {
    days: ReturnType<typeof buildAttendanceDays>;
    isVietnamese: boolean;
    labels: EmployeeDetailTabsLabels;
    logByDate: Map<string, any>;
}) {
    if (days.length === 0) {
        return (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
                {labels.attendance.empty}
            </div>
        );
    }

    return (
        <div className="space-y-2">
            {days.map((day) => {
                const log = logByDate.get(day.key);
                const isWeekend = day.isSaturday || day.isSunday;

                return (
                    <div
                        className={`flex flex-col gap-2.5 rounded-xl border p-2.5 transition sm:flex-row sm:items-center sm:justify-between ${isWeekend
                            ? "border-slate-200/60 bg-slate-50/50"
                            : log?.status === AttendanceLogStatus.SUCCESS
                                ? "border-emerald-100 bg-white hover:border-emerald-200 shadow-2xs"
                                : log?.status === AttendanceLogStatus.REJECTED
                                    ? "border-red-100 bg-white hover:border-red-200 shadow-2xs"
                                    : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
                            }`}
                        key={day.key}
                    >
                        {/* Left: Date & Weekday Badge + Work Mode */}
                        <div className="flex items-center gap-3">
                            <div
                                className={`flex h-10 w-11 shrink-0 flex-col items-center justify-center rounded-lg text-center ${isWeekend
                                    ? "bg-slate-200/60 text-slate-500"
                                    : "bg-slate-100 text-slate-800"
                                    }`}
                            >
                                <span className="text-xxs font-bold uppercase tracking-wider">
                                    {day.weekday}
                                </span>
                                <span className="text-xs font-bold tabular-nums">
                                    {day.label}
                                </span>
                            </div>

                            <div>
                                <p className="text-xs font-semibold tabular-nums text-slate-900">
                                    {day.key.split("-").reverse().join("/")}
                                </p>
                                <div className="mt-0.5 flex items-center gap-1.5 text-xxs text-slate-500">
                                    <WorkModeBadge labels={labels} mode={log?.work_mode} />
                                </div>
                            </div>
                        </div>

                        {/* Right: Check-in Time & Status Chip */}
                        <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-2 sm:border-0 sm:pt-0">
                            <div className="flex items-center gap-1 text-xs text-slate-600">
                                <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                                <span className="font-semibold tabular-nums">
                                    {formatCheckInTime(log?.check_in_at) || "---"}
                                </span>
                            </div>

                            <AttendanceStatus
                                isFuture={day.isFuture}
                                isWeekend={isWeekend}
                                labels={labels}
                                status={log?.status}
                            />
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function WorkModeBadge({
    labels,
    mode,
}: {
    labels: EmployeeDetailTabsLabels;
    mode?: AttendanceWorkMode | null;
}) {
    if (!mode) {
        return (
            <span className="inline-flex items-center gap-1 text-slate-400">
                <Building2 className="h-3 w-3" />
                ---
            </span>
        );
    }
    if (mode === AttendanceWorkMode.WORK_FROM_HOME) {
        return (
            <span className="inline-flex items-center gap-1 font-medium text-purple-700">
                <Laptop className="h-3 w-3" />
                {labels.attendance.remote}
            </span>
        );
    }
    if (mode === AttendanceWorkMode.BUSINESS_TRIP) {
        return (
            <span className="inline-flex items-center gap-1 font-medium text-teal-700">
                <Briefcase className="h-3 w-3" />
                {labels.attendance.businessTrip}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 font-medium text-slate-700">
            <Building2 className="h-3 w-3 text-slate-400" />
            {labels.attendance.office}
        </span>
    );
}

function AttendanceStatus({
    isFuture,
    isWeekend,
    labels,
    status,
}: {
    isFuture: boolean;
    isWeekend: boolean;
    labels: EmployeeDetailTabsLabels;
    status?: AttendanceLogStatus;
}) {
    if (status === AttendanceLogStatus.SUCCESS) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xxs font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                {labels.attendance.success}
            </span>
        );
    }
    if (status === AttendanceLogStatus.REJECTED) {
        return (
            <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xxs font-semibold text-red-700">
                <XCircle className="h-3 w-3" />
                {labels.attendance.rejected}
            </span>
        );
    }
    if (isWeekend) {
        return (
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-xxs font-medium text-slate-500">
                {labels.attendance.weekend}
            </span>
        );
    }
    if (isFuture) {
        return (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xxs font-medium text-slate-400">
                {labels.attendance.future}
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xxs font-semibold text-amber-700">
            <AlertCircle className="h-3 w-3" />
            {labels.attendance.missing}
        </span>
    );
}

function MonthButton({
    children,
    label,
    onClick,
}: {
    children: React.ReactNode;
    label: string;
    onClick: () => void;
}) {
    return (
        <button
            aria-label={label}
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
            onClick={onClick}
            title={label}
            type="button"
        >
            {children}
        </button>
    );
}

function SummaryCard({
    icon,
    label,
    tone,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    tone: "green" | "red" | "amber" | "slate";
    value: number;
}) {
    const tones = {
        green: "bg-emerald-50 text-emerald-700 border-emerald-100",
        red: "bg-red-50 text-red-700 border-red-100",
        amber: "bg-amber-50 text-amber-700 border-amber-100",
        slate: "bg-slate-100 text-slate-700 border-slate-200",
    };
    return (
        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white p-2.5 shadow-2xs">
            <div
                className={`flex size-8 aspect-square items-center justify-center rounded-lg border ${tones[tone]}`}
            >
                {icon}
            </div>
            <div className="min-w-0 flex-1">
                <p className="text-sm font-bold tabular-nums text-slate-900">
                    {value}
                </p>
                <p className="truncate text-xxs font-medium text-slate-500">
                    {label}
                </p>
            </div>
        </div>
    );
}

function AttendanceSkeleton({ viewMode }: { viewMode: ViewMode }) {
    return (
        <div className="space-y-4" role="status">
            {(viewMode === "grid" || viewMode === "split") && (
                <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-3">
                    <div className="h-4 w-32 animate-pulse rounded-md bg-slate-200" />
                    <div className="grid grid-cols-7 gap-1">
                        {Array.from({ length: 35 }, (_, i) => (
                            <div
                                className="h-10 animate-pulse rounded-lg bg-slate-100"
                                key={i}
                            />
                        ))}
                    </div>
                </div>
            )}
            {(viewMode === "list" || viewMode === "split") && (
                <div className="space-y-2">
                    {Array.from({ length: 6 }, (_, i) => (
                        <div
                            className="h-12 animate-pulse rounded-xl border border-slate-200 bg-slate-100"
                            key={i}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
