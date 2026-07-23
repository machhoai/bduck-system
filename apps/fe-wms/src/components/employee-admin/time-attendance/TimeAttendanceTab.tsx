"use client";

import type { User, UserWarehouseRole } from "@bduck/shared-types";
import { AlertTriangle, CheckCircle2, UsersRound } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { LateArrivalReportSheet } from "./LateArrivalReportSheet";
import { TimeAttendanceCalendar } from "./TimeAttendanceCalendar";
import { TimeAttendanceFilters } from "./TimeAttendanceFilters";
import { TimeAttendanceSettingsPanel } from "./TimeAttendanceSettingsPanel";
import { TimeAttendanceSkeleton } from "./TimeAttendanceSkeleton";
import { TimeCheckInPanel } from "./TimeCheckInPanel";
import { buildTimeAttendanceExportConfig } from "./timeAttendanceExport";
import {
    useAllAttendanceExemptions,
    useAttendanceContext,
    useAttendanceExemptions,
    useAttendanceLateReports,
    useAttendanceLogs,
    useAttendancePolicies,
} from "@/hooks/useAttendance";
import {
    useEmployeeProfiles,
    useMyEmployeeProfile,
} from "@/hooks/useEmployeeProfiles";
import { useExportRegistration } from "@/hooks/useExportRegistration";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import {
    getFacilityPermissionScope,
    scopeContainsFacility,
} from "@/utils/facilityPermissionScope";
import {
    buildAttendanceDays,
    getCurrentMonthKey,
    getTodayKey,
    getWeekStartKey,
    type AttendanceRangeMode,
    type AttendanceEmployeeRow,
} from "@/utils/attendance";

type UserWithAssignments = User & { assignments?: UserWarehouseRole[] };

function fallbackLabels(t: ReturnType<typeof useTranslation>["t"]) {
    return (t as any).attendance as Record<string, string>;
}

export function TimeAttendanceTab() {
    const { t } = useTranslation();
    const labels = fallbackLabels(t);
    const user = useUserStore((state) => state.user);
    const permissions = useUserStore((state) => state.permissions);
    const hasPermission = useUserStore((state) => state.hasPermission);
    const { users, isLoading: usersLoading } = useUsers();
    const { profiles, isLoading: profilesLoading } = useEmployeeProfiles();
    const { profile: myProfile, isLoading: myProfileLoading } =
        useMyEmployeeProfile();
    const { warehouses, loading: warehousesLoading } = useWarehouses();
    const {
        context,
        loading: contextLoading,
        error,
        checkIn,
        reportLate,
    } = useAttendanceContext();
    const {
        policyByWarehouse,
        loading: policiesLoading,
        updatePolicy,
    } = useAttendancePolicies();
    const { exemptions: allExemptions } = useAllAttendanceExemptions();
    const [mode, setMode] = useState<AttendanceRangeMode>("month");
    const [month, setMonth] = useState(getCurrentMonthKey());
    const [weekStart, setWeekStart] = useState(getWeekStartKey());
    const [selectedWarehouseId, setSelectedWarehouseId] = useState("ALL");
    const [selectedSettingsWarehouseId, setSelectedSettingsWarehouseId] =
        useState("");
    const [selectedUserId, setSelectedUserId] = useState("ALL");
    const [lateReportOpen, setLateReportOpen] = useState(false);

    useEffect(() => {
        if (typeof window !== "undefined" && window.innerWidth < 1024) {
            setMode("month");
        }
    }, []);

    const days = useMemo(
        () => buildAttendanceDays(mode, mode === "month" ? month : weekStart),
        [mode, month, weekStart],
    );
    const { logs, loading: logsLoading } = useAttendanceLogs(
        days[0]?.key || "",
        days[days.length - 1]?.key || "",
    );
    const { reports: lateReports, loading: lateReportsLoading } =
        useAttendanceLateReports(
            days[0]?.key || "",
            days[days.length - 1]?.key || "",
        );
    const canViewAttendance = hasPermission("attendance.view");
    const canConfigureAttendance = hasPermission("attendance.config");
    const canExportAttendance = hasPermission("attendance.export");

    const viewFacilityScope = useMemo(
        () => getFacilityPermissionScope(permissions, ["attendance.view"]),
        [permissions],
    );
    const configFacilityScope = useMemo(
        () => getFacilityPermissionScope(permissions, ["attendance.config"]),
        [permissions],
    );
    const visibleWarehouses = useMemo(() => {
        if (!canViewAttendance) {
            return warehouses.filter(
                (warehouse) => warehouse.id === context?.warehouse_id,
            );
        }
        return warehouses.filter((warehouse) =>
            scopeContainsFacility(viewFacilityScope, warehouse.id),
        );
    }, [
        canViewAttendance,
        context?.warehouse_id,
        viewFacilityScope,
        warehouses,
    ]);
    const configurableWarehouses = useMemo(
        () =>
            canConfigureAttendance
                ? warehouses.filter((warehouse) =>
                    scopeContainsFacility(configFacilityScope, warehouse.id),
                )
                : [],
        [canConfigureAttendance, configFacilityScope, warehouses],
    );
    useEffect(() => {
        if (
            configurableWarehouses.some(
                (warehouse) => warehouse.id === selectedSettingsWarehouseId,
            )
        ) {
            return;
        }
        setSelectedSettingsWarehouseId(configurableWarehouses[0]?.id || "");
    }, [configurableWarehouses, selectedSettingsWarehouseId]);
    const settingsWarehouseId = selectedSettingsWarehouseId || null;
    const { exemptions: settingsExemptions, updateExemptions } =
        useAttendanceExemptions(settingsWarehouseId);
    const visibleWarehouseIds = useMemo(
        () => new Set(visibleWarehouses.map((warehouse) => warehouse.id)),
        [visibleWarehouses],
    );
    const warehouseById = useMemo(
        () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
        [warehouses],
    );
    const userById = useMemo(
        () => new Map((users as UserWithAssignments[]).map((item) => [item.id, item])),
        [users],
    );
    const exemptUserWarehouseKeys = useMemo(
        () =>
            new Set(
                allExemptions
                    .filter((item) => item.attendance_required === false)
                    .map((item) => `${item.user_id}:${item.warehouse_id}`),
            ),
        [allExemptions],
    );

    const employeeRows = useMemo<AttendanceEmployeeRow[]>(() => {
        if (!user) return [];

        if (!canViewAttendance) {
            const personalUser = userById.get(user.id) || user;
            return context?.can_check_in && myProfile
                ? [
                    {
                        profile: myProfile,
                        user: personalUser,
                        warehouse: warehouseById.get(context.warehouse_id || "") || null,
                    },
                ]
                : [];
        }

        const selectedWarehouseScope =
            selectedWarehouseId === "ALL"
                ? visibleWarehouseIds
                : new Set([selectedWarehouseId]);

        return profiles
            .flatMap((profile) => {
                if (!profile.user_id) return [];
                const targetWarehouseId = profile.workplace_warehouse_id;
                const policy = policyByWarehouse.get(targetWarehouseId);
                const linkedUser = userById.get(profile.user_id);
                if (
                    !linkedUser ||
                    !selectedWarehouseScope.has(targetWarehouseId) ||
                    !policy?.enabled ||
                    exemptUserWarehouseKeys.has(`${profile.user_id}:${targetWarehouseId}`)
                ) {
                    return [];
                }
                return [
                    {
                        profile,
                        user: linkedUser,
                        warehouse: warehouseById.get(targetWarehouseId) || null,
                    },
                ];
            })
            .filter(
                (row) => selectedUserId === "ALL" || row.user.id === selectedUserId,
            );
    }, [
        canViewAttendance,
        context?.can_check_in,
        context?.warehouse_id,
        exemptUserWarehouseKeys,
        myProfile,
        policyByWarehouse,
        profiles,
        selectedUserId,
        selectedWarehouseId,
        user,
        userById,
        visibleWarehouseIds,
        warehouseById,
    ]);

    const filteredLogs = useMemo(() => {
        const employeeIds = new Set(employeeRows.map((row) => row.user.id));
        const warehouseIds =
            selectedWarehouseId === "ALL"
                ? visibleWarehouseIds
                : new Set([selectedWarehouseId]);
        return logs.filter(
            (log) =>
                employeeIds.has(log.user_id) &&
                warehouseIds.has(log.warehouse_id) &&
                log.attendance_date <= days[days.length - 1]?.key,
        );
    }, [days, employeeRows, logs, selectedWarehouseId, visibleWarehouseIds]);

    const mobileStats = useMemo(() => {
        const todayKey = getTodayKey();
        const todayLogs = filteredLogs.filter(
            (log) => log.attendance_date === todayKey && log.status === "SUCCESS",
        );
        const rejectedLogs = filteredLogs.filter((log) => log.status === "REJECTED");
        return {
            checkedToday: todayLogs.length,
            rejected: rejectedLogs.length,
        };
    }, [filteredLogs]);

    const exportConfig = useMemo(() => {
        if (!canExportAttendance) return null;
        return buildTimeAttendanceExportConfig({
            labels,
            rows: employeeRows,
            days,
            logs: filteredLogs,
            warehouseId:
                selectedWarehouseId === "ALL" ? undefined : selectedWarehouseId,
        });
    }, [
        canExportAttendance,
        days,
        employeeRows,
        filteredLogs,
        labels,
        selectedWarehouseId,
    ]);
    useExportRegistration(exportConfig);

    const isLoading =
        contextLoading ||
        usersLoading ||
        profilesLoading ||
        myProfileLoading ||
        warehousesLoading ||
        policiesLoading;

    if (isLoading) return <TimeAttendanceSkeleton />;

    if (error || !context?.can_access_page) {
        return (
            <div className="flex min-h-96 items-center justify-center">
                <div className="max-w-[680px] rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-4 text-center">
                    <AlertTriangle className="mx-auto mb-3 text-[#b42318]" size={28} />
                    <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
                        {labels.noAccessTitle}
                    </h1>
                    <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                        {error || labels.noAccessHint}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-1 flex-col gap-3 w-full pb-4 lg:gap-4 lg:pb-0">
            <header className="hidden flex-col gap-3 md:flex-row md:items-center md:justify-between lg:flex">
                <div>
                    <h1 className="font-[var(--font-display)] text-lg font-bold text-[var(--color-text-primary)]">
                        {labels.title}
                    </h1>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                        {labels.subtitle}
                    </p>
                </div>
            </header>

            {/* Mobile Header Stats — shown at the top of the content on mobile */}
            <div className="grid grid-cols-2 gap-2 lg:hidden">
                <MobileStat icon={<UsersRound size={15} />} label={labels.employees} value={employeeRows.length} />
                <MobileStat icon={<CheckCircle2 size={15} />} label={labels.today || "Today"} value={mobileStats.checkedToday} tone="success" />
            </div>

            <div className="grid gap-3 xl:grid-cols-[200px_minmax(0,1fr)] lg:gap-4">
                <TimeCheckInPanel
                    context={context}
                    labels={labels}
                    onCheckIn={checkIn}
                    onReportLate={() => setLateReportOpen(true)}
                />
                <div className={context.can_check_in ? "" : "xl:col-span-2"}>
                    <TimeAttendanceFilters
                        labels={labels}
                        canViewAttendance={canViewAttendance}
                        warehouses={visibleWarehouses}
                        employeeRows={employeeRows}
                        selectedWarehouseId={selectedWarehouseId}
                        selectedUserId={selectedUserId}
                        mode={mode}
                        month={month}
                        weekStart={weekStart}
                        onWarehouseChange={(value) => {
                            setSelectedWarehouseId(value);
                            setSelectedUserId("ALL");
                        }}
                        onUserChange={setSelectedUserId}
                        onModeChange={setMode}
                        onMonthChange={setMonth}
                        onWeekStartChange={setWeekStart}
                    />
                </div>
            </div>

            <TimeAttendanceCalendar
                labels={labels}
                days={days}
                rows={employeeRows}
                logs={filteredLogs}
                lateReports={lateReports}
                loading={logsLoading || lateReportsLoading}
                mode={mode}
                month={month}
                weekStart={weekStart}
                onMonthChange={setMonth}
                onWeekStartChange={setWeekStart}
            />

            <TimeAttendanceSettingsPanel
                labels={labels}
                canConfigure={canConfigureAttendance}
                warehouses={configurableWarehouses}
                users={users as UserWithAssignments[]}
                profiles={profiles}
                selectedWarehouseId={settingsWarehouseId || "ALL"}
                policies={policyByWarehouse}
                exemptions={settingsExemptions}
                onWarehouseChange={setSelectedSettingsWarehouseId}
                onSavePolicy={updatePolicy}
                onSaveExemptions={updateExemptions}
            />

            <LateArrivalReportSheet
                open={lateReportOpen}
                labels={labels}
                onSubmit={reportLate}
                onClose={() => setLateReportOpen(false)}
            />
        </div>
    );
}

function MobileStat({
    icon,
    label,
    value,
    tone = "default",
}: {
    icon: ReactNode;
    label: string;
    value: number;
    tone?: "default" | "success" | "danger";
}) {
    const toneClass =
        tone === "success"
            ? "text-[#257a3e]"
            : tone === "danger"
                ? "text-[#b42318]"
                : "text-[var(--color-brand-primary)]";

    return (
        <div className="min-w-0 rounded-2xl bg-white px-3 py-2 shadow-sm">
            <div className={`mb-1 flex items-center gap-1.5 ${toneClass}`}>
                {icon}
                <span className="truncate text-[10px] font-semibold">{label}</span>
            </div>
            <p className="text-lg font-semibold tabular-nums text-[var(--color-text-primary)]">
                {value}
            </p>
        </div>
    );
}
