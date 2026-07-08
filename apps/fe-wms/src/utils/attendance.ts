import type {
  AttendanceLateReport,
  AttendanceLog,
  EmployeeProfile,
  User,
  UserWarehouseRole,
  Warehouse,
} from "@bduck/shared-types";

export type AttendanceRangeMode = "week" | "month";

export interface AttendanceDay {
  key: string;
  date: Date;
  label: string;
  weekday: string;
  isSaturday: boolean;
  isSunday: boolean;
  isFuture: boolean;
}

export interface AttendanceEmployeeRow {
  profile: EmployeeProfile;
  user: User & { assignments?: UserWarehouseRole[] };
  warehouse: Warehouse | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const formatDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getCurrentMonthKey = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

export const getTodayKey = () => formatDateKey(new Date());

export const getWeekStartKey = (date = new Date()) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  return formatDateKey(copy);
};

export const buildAttendanceDays = (
  mode: AttendanceRangeMode,
  anchor: string,
): AttendanceDay[] => {
  const todayKey = getTodayKey();
  const days: Date[] = [];

  if (mode === "month") {
    const [year, month] = anchor.split("-").map(Number);
    const lastDate = new Date(year, month, 0).getDate();
    for (let day = 1; day <= lastDate; day += 1) {
      days.push(new Date(year, month - 1, day));
    }
  } else {
    const start = new Date(`${anchor}T00:00:00`);
    for (let index = 0; index < 7; index += 1) {
      days.push(new Date(start.getTime() + index * DAY_MS));
    }
  }

  return days.map((date) => {
    const key = formatDateKey(date);
    const day = date.getDay();
    return {
      key,
      date,
      label: String(date.getDate()).padStart(2, "0"),
      weekday: ["CN", "T2", "T3", "T4", "T5", "T6", "T7"][day],
      isSaturday: day === 6,
      isSunday: day === 0,
      isFuture: key > todayKey,
    };
  });
};

export const formatCheckInTime = (value: unknown) => {
  if (!value) return "";
  const raw = value as {
    toDate?: () => Date;
    seconds?: number;
    _seconds?: number;
  };
  const date =
    typeof raw.toDate === "function"
      ? raw.toDate()
      : typeof raw.seconds === "number"
        ? new Date(raw.seconds * 1000)
        : typeof raw._seconds === "number"
          ? new Date(raw._seconds * 1000)
          : new Date(value as string);

  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  });
};

const toTimestampMs = (value: unknown) => {
  if (!value) return 0;
  const raw = value as {
    toDate?: () => Date;
    seconds?: number;
    _seconds?: number;
  };
  const date =
    typeof raw.toDate === "function"
      ? raw.toDate()
      : typeof raw.seconds === "number"
        ? new Date(raw.seconds * 1000)
        : typeof raw._seconds === "number"
          ? new Date(raw._seconds * 1000)
          : new Date(value as string);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export const getActiveWarehouseIds = (
  assignments: UserWarehouseRole[] = [],
) => {
  const now = new Date();
  return Array.from(
    new Set(
      assignments
        .filter((assignment) => {
          if (!assignment.is_active || !assignment.warehouse_id) return false;
          if (assignment.valid_from && new Date(assignment.valid_from) > now)
            return false;
          if (assignment.valid_until && new Date(assignment.valid_until) < now)
            return false;
          return true;
        })
        .map((assignment) => assignment.warehouse_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
};

export const buildSuccessLogMap = (logs: AttendanceLog[]) => {
  const map = new Map<string, AttendanceLog>();
  logs
    .filter((log) => log.status === "SUCCESS")
    .forEach((log) => {
      map.set(`${log.user_id}:${log.attendance_date}`, log);
    });
  return map;
};

export const buildLatestLateReportMap = (reports: AttendanceLateReport[]) => {
  const map = new Map<string, AttendanceLateReport>();
  reports.forEach((report) => {
    const key = `${report.user_id}:${report.attendance_date}`;
    const current = map.get(key);
    const currentTime = toTimestampMs(current?.sync_time);
    const nextTime = toTimestampMs(report.sync_time);
    if (!current || nextTime >= currentTime) {
      map.set(key, report);
    }
  });
  return map;
};
