"use client";

import type { User, UserWarehouseRole, Warehouse } from "@bduck/shared-types";
import { AlertTriangle, CalendarCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { AttendanceAuditLog } from "./AttendanceAuditLog";
import { AttendanceCalendar } from "./AttendanceCalendar";
import { AttendanceCheckInPanel } from "./AttendanceCheckInPanel";
import { AttendanceFilters } from "./AttendanceFilters";
import { AttendanceSettingsPanel } from "./AttendanceSettingsPanel";
import { AttendanceSkeleton } from "./AttendanceSkeleton";
import { buildAttendanceExportConfig } from "./attendanceExport";
import {
  useAllAttendanceExemptions,
  useAttendanceContext,
  useAttendanceExemptions,
  useAttendanceLogs,
  useAttendancePolicies,
} from "@/hooks/useAttendance";
import { useExportRegistration } from "@/hooks/useExportRegistration";
import { useUsers } from "@/hooks/useUsers";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import {
  buildAttendanceDays,
  getActiveWarehouseIds,
  getCurrentMonthKey,
  getWeekStartKey,
  type AttendanceRangeMode,
  type AttendanceEmployeeRow,
} from "@/utils/attendance";

type UserWithAssignments = User & { assignments?: UserWarehouseRole[] };

function getScopedWarehouseIds(
  permissions: Record<string, Record<string, unknown>>,
  action: string,
) {
  const globalPerms = permissions.global || {};
  if (globalPerms["*"] === true || globalPerms[action] === true)
    return undefined;

  return Object.entries(permissions)
    .filter(
      ([scope, scoped]) =>
        scope !== "global" && (scoped["*"] === true || scoped[action] === true),
    )
    .map(([scope]) => scope);
}

function fallbackLabels(t: ReturnType<typeof useTranslation>["t"]) {
  return (t as any).attendance as Record<string, string>;
}

export function AttendancePage() {
  const { t } = useTranslation();
  const labels = fallbackLabels(t);
  const user = useUserStore((state) => state.user);
  const permissions = useUserStore((state) => state.permissions);
  const roleAssignments = useUserStore((state) => state.roleAssignments);
  const hasPermission = useUserStore((state) => state.hasPermission);
  const { users, isLoading: usersLoading } = useUsers();
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const {
    context,
    loading: contextLoading,
    error,
    checkIn,
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
  const [selectedUserId, setSelectedUserId] = useState("ALL");

  const days = useMemo(
    () => buildAttendanceDays(mode, mode === "month" ? month : weekStart),
    [mode, month, weekStart],
  );
  const { logs, loading: logsLoading } = useAttendanceLogs(
    days[0]?.key || "",
    days[days.length - 1]?.key || "",
  );
  const settingsWarehouseId =
    selectedWarehouseId !== "ALL"
      ? selectedWarehouseId
      : context?.warehouse_id || warehouses[0]?.id || null;
  const { exemptions: settingsExemptions, updateExemptions } =
    useAttendanceExemptions(settingsWarehouseId);

  const canViewAttendance = hasPermission("attendance.view");
  const canConfigureAttendance = hasPermission("attendance.config");
  const canExportAttendance = hasPermission("attendance.export");

  const scopedWarehouseIds = useMemo(
    () => getScopedWarehouseIds(permissions, "attendance.view"),
    [permissions],
  );
  const visibleWarehouses = useMemo(() => {
    if (!canViewAttendance) {
      return warehouses.filter(
        (warehouse) => warehouse.id === context?.warehouse_id,
      );
    }
    return scopedWarehouseIds
      ? warehouses.filter((warehouse) =>
          scopedWarehouseIds.includes(warehouse.id),
        )
      : warehouses;
  }, [
    canViewAttendance,
    context?.warehouse_id,
    scopedWarehouseIds,
    warehouses,
  ]);
  const visibleWarehouseIds = useMemo(
    () => new Set(visibleWarehouses.map((warehouse) => warehouse.id)),
    [visibleWarehouses],
  );
  const warehouseById = useMemo(
    () => new Map(warehouses.map((warehouse) => [warehouse.id, warehouse])),
    [warehouses],
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
      const personalUser: UserWithAssignments = {
        ...user,
        assignments: roleAssignments,
      };
      return context?.can_check_in
        ? [
            {
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

    return (users as UserWithAssignments[])
      .flatMap((item) => {
        const activeWarehouseIds = getActiveWarehouseIds(
          item.assignments || [],
        );
        const targetWarehouseId = activeWarehouseIds.find((warehouseId) => {
          const policy = policyByWarehouse.get(warehouseId);
          return (
            selectedWarehouseScope.has(warehouseId) &&
            policy?.enabled &&
            !exemptUserWarehouseKeys.has(`${item.id}:${warehouseId}`)
          );
        });
        if (!targetWarehouseId) return [];
        return [
          {
            user: item,
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
    policyByWarehouse,
    roleAssignments,
    selectedUserId,
    selectedWarehouseId,
    user,
    users,
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

  const exportConfig = useMemo(() => {
    if (!canExportAttendance) return null;
    return buildAttendanceExportConfig({
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
    contextLoading || usersLoading || warehousesLoading || policiesLoading;

  if (isLoading) return <AttendanceSkeleton />;

  if (error || !context?.can_access_page) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <div className="max-w-md rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-6 text-center">
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
    <div className="flex w-full flex-col gap-4">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#0066cc12] px-3 py-1 text-xs font-semibold text-[#0066cc]">
            <CalendarCheck size={14} />
            {labels.badge}
          </div>
          <h1 className="font-[var(--font-display)] text-xl font-semibold text-[var(--color-text-primary)]">
            {labels.title}
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {labels.subtitle}
          </p>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <AttendanceCheckInPanel
          context={context}
          labels={labels}
          onCheckIn={checkIn}
        />
        <div className={context.can_check_in ? "" : "xl:col-span-2"}>
          <AttendanceFilters
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

      <AttendanceCalendar
        labels={labels}
        days={days}
        rows={employeeRows}
        logs={filteredLogs}
        loading={logsLoading}
      />

      <AttendanceAuditLog
        labels={labels}
        logs={filteredLogs}
        canView={canViewAttendance}
      />

      <AttendanceSettingsPanel
        labels={labels}
        canConfigure={canConfigureAttendance}
        warehouses={
          visibleWarehouses.length
            ? visibleWarehouses
            : (warehouses as Warehouse[])
        }
        users={users as UserWithAssignments[]}
        selectedWarehouseId={settingsWarehouseId || "ALL"}
        policies={policyByWarehouse}
        exemptions={settingsExemptions}
        onWarehouseChange={setSelectedWarehouseId}
        onSavePolicy={updatePolicy}
        onSaveExemptions={updateExemptions}
      />
    </div>
  );
}
