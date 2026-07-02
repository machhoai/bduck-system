import type { AttendanceLog } from "@bduck/shared-types";
import type { ExportConfig } from "@/utils/exportExcel";
import {
  formatCheckInTime,
  buildSuccessLogMap,
  type AttendanceDay,
  type AttendanceEmployeeRow,
} from "@/utils/attendance";

export function buildAttendanceExportConfig({
  labels,
  rows,
  days,
  logs,
  warehouseId,
}: {
  labels: Record<string, string>;
  rows: AttendanceEmployeeRow[];
  days: AttendanceDay[];
  logs: AttendanceLog[];
  warehouseId?: string;
}): ExportConfig {
  const successMap = buildSuccessLogMap(logs);
  const data = rows.map((row) => {
    const item: Record<string, string> = {
      employee_id: row.profile.employee_code,
      employee_name: row.profile.full_name,
      warehouse: row.warehouse?.name || "",
    };
    days.forEach((day) => {
      item[day.key] = formatCheckInTime(
        successMap.get(`${row.user.id}:${day.key}`)?.check_in_at,
      );
    });
    return item;
  });

  return {
    filename: "attendance",
    entityType: "attendance_logs",
    warehouseId,
    filters: {
      date_from: days[0]?.key,
      date_to: days[days.length - 1]?.key,
    },
    columns: [
      { header: labels.employeeCode, key: "employee_id", width: 18 },
      { header: labels.employeeName, key: "employee_name", width: 28 },
      { header: labels.warehouse, key: "warehouse", width: 24 },
      ...days.map((day) => ({
        header: `${day.weekday} ${day.key}`,
        key: day.key,
        width: 14,
      })),
    ],
    data,
  };
}
