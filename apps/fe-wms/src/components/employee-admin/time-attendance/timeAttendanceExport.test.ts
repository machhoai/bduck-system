import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

import {
  AttendanceLogStatus,
  LeaveDayPortion,
  LeaveRequestStatus,
  LeaveRequestType,
  type AttendanceLog,
  type AttendanceLeaveDay,
  type CompanyHoliday,
} from "@bduck/shared-types";

import {
  buildTimeAttendanceWorkbook,
  isLateMorningCheckIn,
  resolveAttendanceDay,
} from "./timeAttendanceExport";
import type {
  AttendanceDay,
  AttendanceEmployeeRow,
} from "@/utils/attendance";

const leaveDay = (
  portion: LeaveDayPortion,
  requestType = LeaveRequestType.PAID_ANNUAL,
  status = LeaveRequestStatus.PENDING_APPROVAL,
): AttendanceLeaveDay => ({
  leave_request_id: "request-1",
  employee_profile_id: "profile-1",
  employee_user_id: "user-1",
  warehouse_id: "warehouse-1",
  attendance_date: "2026-09-01",
  request_type: requestType,
  portion,
  status,
});

const resolve = (
  overrides: Partial<Parameters<typeof resolveAttendanceDay>[0]> = {},
) =>
  resolveAttendanceDay({
    hasCheckIn: false,
    leaveDays: [],
    isEligible: true,
    isWeekend: false,
    isFuture: false,
    isToday: false,
    ...overrides,
  });

test("marks historical absence without a leave request as KP", () => {
  assert.deepEqual(resolve(), {
    status: "KP",
    workedUnits: 0,
    paidLeaveUnits: 0,
    unpaidLeaveUnits: 0,
    unauthorizedUnits: 1,
    holidayUnits: 0,
  });
});

test("counts pending full-day leave and unpaid leave", () => {
  assert.equal(
    resolve({ leaveDays: [leaveDay(LeaveDayPortion.FULL_DAY)] }).status,
    "P",
  );
  assert.equal(
    resolve({
      leaveDays: [
        leaveDay(LeaveDayPortion.FULL_DAY, LeaveRequestType.UNPAID),
      ],
    }).status,
    "N0",
  );
});

test("uses half-day leave code when the other half has a check-in", () => {
  const morning = resolve({
    hasCheckIn: true,
    leaveDays: [leaveDay(LeaveDayPortion.MORNING)],
  });
  const afternoon = resolve({
    hasCheckIn: true,
    leaveDays: [leaveDay(LeaveDayPortion.AFTERNOON)],
  });

  assert.equal(morning.status, "sP");
  assert.equal(morning.workedUnits, 0.5);
  assert.equal(afternoon.status, "cP");
  assert.equal(afternoon.workedUnits, 0.5);
});

test("combines half-day leave with KP when the other half has no check-in", () => {
  const morning = resolve({
    leaveDays: [leaveDay(LeaveDayPortion.MORNING)],
  });
  const afternoon = resolve({
    leaveDays: [leaveDay(LeaveDayPortion.AFTERNOON)],
  });

  assert.equal(morning.status, "sP/KP");
  assert.equal(morning.paidLeaveUnits, 0.5);
  assert.equal(morning.unauthorizedUnits, 0.5);
  assert.equal(afternoon.status, "KP/cP");
  assert.equal(afternoon.paidLeaveUnits, 0.5);
  assert.equal(afternoon.unauthorizedUnits, 0.5);
});

test("does not finalize KP for today or future dates", () => {
  assert.equal(resolve({ isToday: true }).status, "");
  assert.equal(resolve({ isFuture: true }).status, "");
  assert.equal(
    resolve({
      isToday: true,
      leaveDays: [leaveDay(LeaveDayPortion.MORNING)],
    }).status,
    "sP",
  );
});

test("counts company holidays as paid company leave", () => {
  const holiday = resolve({ isHoliday: true });
  assert.equal(holiday.status, "CL");
  assert.equal(holiday.holidayUnits, 1);
  assert.equal(resolve({ isHoliday: true, hasCheckIn: true }).status, "x");
});

test("highlights only check-ins strictly after 08:45 and exempts morning leave", () => {
  assert.equal(isLateMorningCheckIn("08:45", "x"), false);
  assert.equal(isLateMorningCheckIn("08:46", "x"), true);
  assert.equal(isLateMorningCheckIn("13:05", "sP"), false);
});

test("writes the three-row employee layout and styles to an xlsx file", async () => {
  const days: AttendanceDay[] = [
    {
      key: "2026-09-01",
      date: new Date("2026-09-01T00:00:00+07:00"),
      label: "01",
      weekday: "T3",
      isSaturday: false,
      isSunday: false,
      isFuture: false,
    },
    {
      key: "2026-09-02",
      date: new Date("2026-09-02T00:00:00+07:00"),
      label: "02",
      weekday: "T4",
      isSaturday: false,
      isSunday: false,
      isFuture: false,
    },
  ];
  const rows = [
    {
      profile: {
        id: "profile-1",
        user_id: "user-1",
        full_name: "Nguyễn Văn An",
        workplace_warehouse_id: "warehouse-1",
      },
      user: { id: "user-1" },
      warehouse: { id: "warehouse-1", name: "Cơ sở Quận 7" },
    } as AttendanceEmployeeRow,
  ];
  const logs = [
    {
      id: "log-1",
      user_id: "user-1",
      employee_profile_id: "profile-1",
      employee_id: "NV001",
      employee_name: "Nguyễn Văn An",
      warehouse_id: "warehouse-1",
      attendance_date: "2026-09-01",
      check_in_at: new Date("2026-09-01T08:46:00+07:00"),
      status: AttendanceLogStatus.SUCCESS,
    } as AttendanceLog,
  ];

  const workbook = buildTimeAttendanceWorkbook({
    rows,
    days,
    logs,
    leaveDays: [],
    holidays: [
      { holiday_date: "2026-09-02" } as CompanyHoliday,
    ],
    lateReports: [],
    todayKey: "2026-09-22",
  });
  const sheet = workbook.getWorksheet("Chấm công");

  assert.ok(sheet);
  assert.equal(sheet.getCell("D15").value, "Trạng thái");
  assert.equal(sheet.getCell("D16").value, "Giờ check-in");
  assert.equal(sheet.getCell("D17").value, "Xin đi trễ");
  assert.equal(sheet.getCell("E15").value, "x");
  assert.equal(sheet.getCell("E15").fill.type, "pattern");
  assert.equal(sheet.getCell("E16").value, "08:46");
  assert.equal(sheet.getCell("E16").fill.type, "pattern");
  assert.equal(sheet.getCell("F15").value, "CL");
  assert.equal(sheet.getCell("K15").value, 1);
  assert.equal(sheet.getCell("L15").value, 2);

  const serialized = await workbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(serialized);
  const savedSheet = reopened.getWorksheet("Chấm công");
  assert.ok(savedSheet);
  assert.equal(savedSheet.getCell("E15").value, "x");
  assert.equal(savedSheet.getCell("E16").value, "08:46");
  assert.equal(savedSheet.getCell("E15").fill.type, "pattern");
  assert.equal(savedSheet.getCell("E16").fill.type, "pattern");
  assert.equal(savedSheet.getCell("F15").value, "CL");
  assert.equal(savedSheet.getCell("L15").value, 2);
});
