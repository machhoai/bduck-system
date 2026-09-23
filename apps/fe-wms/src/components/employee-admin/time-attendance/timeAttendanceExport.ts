import {
    LeaveDayPortion,
    LeaveRequestStatus,
    LeaveRequestType,
    isEmployeeAttendanceEligibleOnDate,
    type AttendanceLateReport,
    type AttendanceLeaveDay,
    type AttendanceLog,
    type CompanyHoliday,
} from "@bduck/shared-types";
import ExcelJS from "exceljs";

import {
    buildLatestLateReportMap,
    buildSuccessLogMap,
    formatCheckInTime,
    getLateReportArrivalTime,
    getTodayKey,
    type AttendanceDay,
    type AttendanceEmployeeRow,
} from "@/utils/attendance";
import type { CustomExportConfig } from "@/utils/exportExcel";

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";
const LATE_CHECK_IN_MINUTES = 8 * 60 + 45;

const COUNTED_LEAVE_STATUSES = new Set<LeaveRequestStatus>([
    LeaveRequestStatus.PENDING_APPROVAL,
    LeaveRequestStatus.APPROVED,
    LeaveRequestStatus.APPROVER_UNAVAILABLE,
]);

type LeaveCode = "P" | "N0";

export interface AttendanceDayResolution {
    status: string;
    workedUnits: number;
    paidLeaveUnits: number;
    unpaidLeaveUnits: number;
    unauthorizedUnits: number;
    holidayUnits: number;
}

interface AttendanceExportInput {
    rows: AttendanceEmployeeRow[];
    days: AttendanceDay[];
    logs: AttendanceLog[];
    leaveDays: AttendanceLeaveDay[];
    holidays: CompanyHoliday[];
    lateReports: AttendanceLateReport[];
    warehouseId?: string;
    todayKey?: string;
}

const emptyResolution = (): AttendanceDayResolution => ({
    status: "",
    workedUnits: 0,
    paidLeaveUnits: 0,
    unpaidLeaveUnits: 0,
    unauthorizedUnits: 0,
    holidayUnits: 0,
});

const leaveCodeForType = (type: LeaveRequestType): LeaveCode | null => {
    if (type === LeaveRequestType.WORK_FROM_HOME) return null;
    return type === LeaveRequestType.UNPAID ? "N0" : "P";
};

const prefixedLeaveCode = (
    portion: LeaveDayPortion.MORNING | LeaveDayPortion.AFTERNOON,
    code: LeaveCode,
) => `${portion === LeaveDayPortion.MORNING ? "s" : "c"}${code}`;

const assignLeavePortions = (leaveDays: AttendanceLeaveDay[]) => {
    let morning: LeaveCode | null = null;
    let afternoon: LeaveCode | null = null;

    leaveDays.forEach((leaveDay) => {
        if (!COUNTED_LEAVE_STATUSES.has(leaveDay.status)) return;
        const code = leaveCodeForType(leaveDay.request_type);
        if (!code) return;
        if (leaveDay.portion === LeaveDayPortion.FULL_DAY) {
            morning = code;
            afternoon = code;
            return;
        }
        if (leaveDay.portion === LeaveDayPortion.MORNING) morning = code;
        if (leaveDay.portion === LeaveDayPortion.AFTERNOON) afternoon = code;
    });

    return { morning, afternoon };
};

const leaveUnits = (morning: LeaveCode | null, afternoon: LeaveCode | null) => ({
    paidLeaveUnits:
        (morning === "P" ? 0.5 : 0) + (afternoon === "P" ? 0.5 : 0),
    unpaidLeaveUnits:
        (morning === "N0" ? 0.5 : 0) + (afternoon === "N0" ? 0.5 : 0),
});

export function resolveAttendanceDay({
    hasCheckIn,
    leaveDays,
    isEligible,
    isWeekend,
    isHoliday = false,
    isFuture,
    isToday,
}: {
    hasCheckIn: boolean;
    leaveDays: AttendanceLeaveDay[];
    isEligible: boolean;
    isWeekend: boolean;
    isHoliday?: boolean;
    isFuture: boolean;
    isToday: boolean;
}): AttendanceDayResolution {
    if (!isEligible) return emptyResolution();
    if (hasCheckIn && isWeekend) {
        return { ...emptyResolution(), status: "x", workedUnits: 1 };
    }
    if (isWeekend) return emptyResolution();
    if (isHoliday && !hasCheckIn) {
        return { ...emptyResolution(), status: "NL", holidayUnits: 1 };
    }

    const { morning, afternoon } = assignLeavePortions(leaveDays);
    const units = leaveUnits(morning, afternoon);

    if (hasCheckIn) {
        if (morning && !afternoon) {
            return {
                status: prefixedLeaveCode(LeaveDayPortion.MORNING, morning),
                workedUnits: 0.5,
                ...units,
                unauthorizedUnits: 0,
                holidayUnits: 0,
            };
        }
        if (!morning && afternoon) {
            return {
                status: prefixedLeaveCode(LeaveDayPortion.AFTERNOON, afternoon),
                workedUnits: 0.5,
                ...units,
                unauthorizedUnits: 0,
                holidayUnits: 0,
            };
        }
        return { ...emptyResolution(), status: "x", workedUnits: 1 };
    }

    if (morning && afternoon) {
        const status =
            morning === afternoon
                ? morning
                : `${prefixedLeaveCode(LeaveDayPortion.MORNING, morning)}/${prefixedLeaveCode(LeaveDayPortion.AFTERNOON, afternoon)}`;
        return { status, workedUnits: 0, ...units, unauthorizedUnits: 0, holidayUnits: 0 };
    }

    const dayIsFinalized = !isFuture && !isToday;
    if (morning) {
        return {
            status: dayIsFinalized
                ? `${prefixedLeaveCode(LeaveDayPortion.MORNING, morning)}/KP`
                : prefixedLeaveCode(LeaveDayPortion.MORNING, morning),
            workedUnits: 0,
            ...units,
            unauthorizedUnits: dayIsFinalized ? 0.5 : 0,
            holidayUnits: 0,
        };
    }
    if (afternoon) {
        return {
            status: dayIsFinalized
                ? `KP/${prefixedLeaveCode(LeaveDayPortion.AFTERNOON, afternoon)}`
                : prefixedLeaveCode(LeaveDayPortion.AFTERNOON, afternoon),
            workedUnits: 0,
            ...units,
            unauthorizedUnits: dayIsFinalized ? 0.5 : 0,
            holidayUnits: 0,
        };
    }
    if (isFuture || isToday) return emptyResolution();
    return { ...emptyResolution(), status: "KP", unauthorizedUnits: 1 };
}

export const isLateMorningCheckIn = (time: string, status: string) => {
    if (status.startsWith("sP") || status.startsWith("sN0")) return false;
    const [hours, minutes] = time.split(":").map(Number);
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return false;
    return hours * 60 + minutes > LATE_CHECK_IN_MINUTES;
};

const columnLetter = (columnNumber: number) => {
    let value = columnNumber;
    let result = "";
    while (value > 0) {
        const remainder = (value - 1) % 26;
        result = String.fromCharCode(65 + remainder) + result;
        value = Math.floor((value - 1) / 26);
    }
    return result;
};

const solidFill = (argb: string): ExcelJS.Fill => ({
    type: "pattern",
    pattern: "solid",
    fgColor: { argb },
});

const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: "thin", color: { argb: "FFD9E2EC" } },
    left: { style: "thin", color: { argb: "FFD9E2EC" } },
    bottom: { style: "thin", color: { argb: "FFD9E2EC" } },
    right: { style: "thin", color: { argb: "FFD9E2EC" } },
};

const statusFontColors: Record<string, string> = {
    P: "FF6D28D9",
    sP: "FF2563EB",
    cP: "FF2563EB",
    N0: "FF64748B",
    sN0: "FF64748B",
    cN0: "FF64748B",
    KP: "FFDC2626",
    NL: "FF0F766E",
};

const specialStatusColor = (status: string) => {
    if (status.includes("KP") && status !== "KP") return "FFC2410C";
    if (status.includes("/")) return "FFC2410C";
    return statusFontColors[status] || "FF334155";
};

const periodLabel = (days: AttendanceDay[]) => {
    const first = days[0]?.key || "";
    const last = days.at(-1)?.key || "";
    if (first.slice(0, 7) === last.slice(0, 7) && first) {
        const [year, month] = first.split("-");
        return `Tháng ${month} năm ${year}`;
    }
    return first && last ? `Từ ${first} đến ${last}` : "";
};

const buildLeaveDayMap = (leaveDays: AttendanceLeaveDay[]) => {
    const result = new Map<string, AttendanceLeaveDay[]>();
    leaveDays.forEach((leaveDay) => {
        const key = `${leaveDay.employee_profile_id}:${leaveDay.attendance_date}`;
        result.set(key, [...(result.get(key) || []), leaveDay]);
    });
    return result;
};

export function buildTimeAttendanceWorkbook({
    rows,
    days,
    logs,
    leaveDays,
    holidays,
    lateReports,
    todayKey = getTodayKey(),
}: AttendanceExportInput) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = "BDuck System";
    workbook.created = new Date();
    workbook.modified = new Date();

    const sheet = workbook.addWorksheet("Chấm công", {
        properties: { defaultRowHeight: 20 },
        views: [{ state: "frozen", xSplit: 4, ySplit: 8, showGridLines: false }],
        pageSetup: {
            orientation: "landscape",
            fitToPage: true,
            fitToWidth: 1,
            fitToHeight: 0,
            paperSize: 9,
            margins: {
                left: 0.25,
                right: 0.25,
                top: 0.4,
                bottom: 0.4,
                header: 0.2,
                footer: 0.2,
            },
        },
    });

    const firstDayColumn = 5;
    const lastDayColumn = firstDayColumn + days.length - 1;
    const firstSummaryColumn = lastDayColumn + 1;
    const lastColumn = firstSummaryColumn + 5;
    const lastColumnLetter = columnLetter(lastColumn);
    const successMap = buildSuccessLogMap(logs);
    const lateReportMap = buildLatestLateReportMap(lateReports);
    const leaveDayMap = buildLeaveDayMap(leaveDays);
    const holidayDates = new Set(holidays.map((holiday) => holiday.holiday_date));

    sheet.mergeCells(1, 1, 1, Math.min(22, lastColumn));
    sheet.getCell(1, 1).value = "CÔNG TY TNHH JOYWORLD ENTERTAINMENT";
    sheet.mergeCells(2, 1, 2, Math.min(22, lastColumn));
    sheet.getCell(2, 1).value =
        "Địa chỉ: 154A Nguyễn Thị Thập, Phường Tân Thuận, Thành phố Hồ Chí Minh";
    sheet.mergeCells(3, 1, 3, Math.min(22, lastColumn));
    sheet.getCell(3, 1).value = "Mã số thuế: 0318958531";
    sheet.mergeCells(4, 1, 4, lastColumn);
    sheet.getCell(4, 1).value = "BẢNG CHẤM CÔNG";
    sheet.mergeCells(5, 1, 5, lastColumn);
    sheet.getCell(5, 1).value = periodLabel(days);

    const statusLegendEndColumn = Math.min(13, lastColumn);
    const statusLegend =
        "Trạng thái\nx: check-in · P: phép · N0: không lương · KP: không phép · NL: Nghỉ hưởng lương";
    const halfDayLegend =
        "Chú thích:\nsP: Nghỉ phép sáng · cP: Nghỉ phép chiều\nsP/KP: Nghỉ phép sáng, chiều không phép · KP/cP: Sáng không phép, nghỉ phép chiều\nCheck-in sau 08:45 tô vàng; sP được miễn";
    const totalsLegend =
        "Tổng công\n(1) Đi làm · (2) Phép · (3) KP · (4) N0 · (5) Nghỉ hưởng lương · (6)=(1)+(2)+(5)";
    const remainingLegendColumns = lastColumn - statusLegendEndColumn;
    const middleLegendEndColumn =
        statusLegendEndColumn + Math.floor(remainingLegendColumns / 2);
    const legendRanges: Array<[number, number, string]> = [
        [5, statusLegendEndColumn, statusLegend],
    ];
    if (remainingLegendColumns >= 12) {
        legendRanges.push(
            [statusLegendEndColumn + 1, middleLegendEndColumn, halfDayLegend],
            [middleLegendEndColumn + 1, lastColumn, totalsLegend],
        );
    } else if (remainingLegendColumns > 0) {
        legendRanges.push([
            statusLegendEndColumn + 1,
            lastColumn,
            "Nửa ngày: sP/cP có phép · sP/KP, KP/cP có nửa ngày KP\n(1) Đi làm · (2) Phép · (3) KP · (4) N0 · (5) NL · (6) Tổng có lương\nSau 08:45 tô vàng; sP được miễn",
        ]);
    }
    legendRanges.forEach(([from, to, text]) => {
        sheet.mergeCells(6, from, 6, to);
        const cell = sheet.getCell(6, from);
        cell.value = text;
        cell.fill = solidFill("FFF8FAFC");
        cell.font = { name: "Arial", size: 9, color: { argb: "FF334155" } };
        cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
        cell.border = thinBorder;
    });

    const fixedHeaders = ["STT", "Họ và tên", "Cơ sở", "Dòng dữ liệu"];
    fixedHeaders.forEach((header, index) => {
        const column = index + 1;
        sheet.mergeCells(7, column, 8, column);
        sheet.getCell(7, column).value = header;
    });
    days.forEach((day, index) => {
        const column = firstDayColumn + index;
        sheet.getCell(7, column).value = day.weekday;
        sheet.getCell(8, column).value = Number(day.label);
    });
    ["(1)", "(2)", "(3)", "(4)", "(5)", "(6)"].forEach(
        (header, index) => {
            const column = firstSummaryColumn + index;
            sheet.mergeCells(7, column, 8, column);
            sheet.getCell(7, column).value = header;
        },
    );

    for (let row = 7; row <= 8; row += 1) {
        for (let column = 1; column <= lastColumn; column += 1) {
            const cell = sheet.getCell(row, column);
            cell.fill = solidFill(row === 7 ? "FF1F4E78" : "FF4472C4");
            cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
            cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
            cell.border = {
                top: { style: "thin", color: { argb: "FFFFFFFF" } },
                left: { style: "thin", color: { argb: "FFFFFFFF" } },
                bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
                right: { style: "thin", color: { argb: "FFFFFFFF" } },
            };
        }
    }

    const summaryTotals = [0, 0, 0, 0, 0, 0];
    rows.forEach((employee, employeeIndex) => {
        const statusRow = 9 + employeeIndex * 3;
        const checkInRow = statusRow + 1;
        const lateRow = statusRow + 2;
        [1, 2, 3].forEach((column) =>
            sheet.mergeCells(statusRow, column, lateRow, column),
        );
        sheet.getCell(statusRow, 1).value = employeeIndex + 1;
        sheet.getCell(statusRow, 2).value = employee.profile.full_name;
        sheet.getCell(statusRow, 3).value = employee.warehouse?.name || "";
        sheet.getCell(statusRow, 4).value = "Trạng thái";
        sheet.getCell(checkInRow, 4).value = "Giờ check-in";
        sheet.getCell(lateRow, 4).value = "Xin đi trễ";

        const employeeSummary = [0, 0, 0, 0, 0, 0];
        days.forEach((day, dayIndex) => {
            const column = firstDayColumn + dayIndex;
            const key = `${employee.user.id}:${day.key}`;
            const log = successMap.get(key);
            const dayLeaves =
                leaveDayMap.get(`${employee.profile.id}:${day.key}`) || [];
            const resolution = resolveAttendanceDay({
                hasCheckIn: Boolean(log),
                leaveDays: dayLeaves,
                isEligible: isEmployeeAttendanceEligibleOnDate(employee.profile, day.key),
                isWeekend: day.isSaturday || day.isSunday,
                isHoliday: holidayDates.has(day.key),
                isFuture: day.key > todayKey,
                isToday: day.key === todayKey,
            });
            const statusCell = sheet.getCell(statusRow, column);
            statusCell.value = resolution.status;
            if (resolution.status === "x") {
                statusCell.fill = solidFill("FFDCFCE7");
                statusCell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF166534" } };
            } else if (resolution.status) {
                statusCell.font = {
                    name: "Arial",
                    size: 9,
                    bold: true,
                    color: { argb: specialStatusColor(resolution.status) },
                };
            }

            if (log) {
                const checkInTime = formatCheckInTime(log.check_in_at);
                const checkInCell = sheet.getCell(checkInRow, column);
                checkInCell.value = checkInTime;
                if (isLateMorningCheckIn(checkInTime, resolution.status)) {
                    checkInCell.fill = solidFill("FFFFF4CC");
                    checkInCell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF9A6700" } };
                }
            }

            const lateReport = lateReportMap.get(key);
            if (lateReport) {
                const arrivalTime = getLateReportArrivalTime(lateReport);
                sheet.getCell(lateRow, column).value = [arrivalTime, lateReport.reason.trim()]
                    .filter(Boolean)
                    .join(" - ");
                sheet.getCell(lateRow, column).font = {
                    name: "Arial",
                    size: 8,
                    color: { argb: "FFC2410C" },
                };
            }

            employeeSummary[0] += resolution.workedUnits;
            employeeSummary[1] += resolution.paidLeaveUnits;
            employeeSummary[2] += resolution.unauthorizedUnits;
            employeeSummary[3] += resolution.unpaidLeaveUnits;
            employeeSummary[4] += resolution.holidayUnits;
        });
        employeeSummary[5] =
            employeeSummary[0] + employeeSummary[1] + employeeSummary[4];

        employeeSummary.forEach((value, index) => {
            const column = firstSummaryColumn + index;
            sheet.mergeCells(statusRow, column, lateRow, column);
            const cell = sheet.getCell(statusRow, column);
            cell.value = value;
            cell.numFmt = "0.0";
            cell.fill = solidFill("FFF8FAFC");
            cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF1E3A8A" } };
            summaryTotals[index] += value;
        });

        for (let row = statusRow; row <= lateRow; row += 1) {
            for (let column = 1; column <= lastColumn; column += 1) {
                const cell = sheet.getCell(row, column);
                cell.border = thinBorder;
                cell.alignment = {
                    vertical: "middle",
                    horizontal: column === 2 || column === 3 ? "left" : "center",
                    wrapText: true,
                };
                if (!cell.font?.name) {
                    cell.font = {
                        name: "Arial",
                        size: column === 4 ? 9 : 10,
                        bold: column === 4,
                        color: { argb: column === 4 ? "FF475569" : "FF334155" },
                    };
                }
            }
        }
        days.forEach((day, dayIndex) => {
            if (!day.isSaturday && !day.isSunday) return;
            const column = firstDayColumn + dayIndex;
            for (let row = statusRow; row <= lateRow; row += 1) {
                const cell = sheet.getCell(row, column);
                if (!cell.value) cell.fill = solidFill("FFF1F5F9");
            }
        });
        sheet.getRow(lateRow).border = {
            bottom: { style: "medium", color: { argb: "FF94A3B8" } },
        };
        for (let column = firstSummaryColumn; column <= lastColumn; column += 1) {
            sheet.getCell(statusRow, column).border = {
                top: { style: "medium", color: { argb: "FF94A3B8" } },
                left: { style: "medium", color: { argb: "FF94A3B8" } },
                bottom: { style: "medium", color: { argb: "FF94A3B8" } },
                right: { style: "medium", color: { argb: "FF94A3B8" } },
            };
        }
        sheet.getRow(statusRow).height = 22;
        sheet.getRow(checkInRow).height = 22;
        sheet.getRow(lateRow).height = 34;
    });

    const totalRow = 9 + rows.length * 3;
    sheet.mergeCells(totalRow, 1, totalRow, lastDayColumn);
    sheet.getCell(totalRow, 1).value = "Tổng cộng";
    summaryTotals.forEach((value, index) => {
        sheet.getCell(totalRow, firstSummaryColumn + index).value = value;
        sheet.getCell(totalRow, firstSummaryColumn + index).numFmt = "0.0";
    });
    for (let column = 1; column <= lastColumn; column += 1) {
        const cell = sheet.getCell(totalRow, column);
        cell.fill = solidFill("FF17365D");
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
            top: { style: "thin", color: { argb: "FFFFFFFF" } },
            left: { style: "thin", color: { argb: "FFFFFFFF" } },
            bottom: { style: "thin", color: { argb: "FFFFFFFF" } },
            right: { style: "thin", color: { argb: "FFFFFFFF" } },
        };
    }
    sheet.getRow(totalRow).height = 24;

    const noteRow = totalRow + 1;
    sheet.mergeCells(noteRow, 1, noteRow, lastColumn);
    sheet.getCell(noteRow, 1).value =
        "Mã sP/KP và KP/cP lần lượt tính 0,5 ngày phép và 0,5 ngày nghỉ không phép. Ngày hiện tại chưa có check-in chưa chốt KP.";
    sheet.getCell(noteRow, 1).font = {
        name: "Arial",
        size: 9,
        italic: true,
        color: { argb: "FF64748B" },
    };

    sheet.getColumn(1).width = 5;
    sheet.getColumn(2).width = 24;
    sheet.getColumn(3).width = 22;
    sheet.getColumn(4).width = 14;
    for (let column = firstDayColumn; column <= lastDayColumn; column += 1) {
        sheet.getColumn(column).width = 7;
    }
    for (let column = firstSummaryColumn; column <= lastColumn; column += 1) {
        sheet.getColumn(column).width = 10;
    }

    sheet.getCell(1, 1).font = { name: "Arial", size: 12, bold: true, color: { argb: "FF1F4E78" } };
    [2, 3].forEach((row) => {
        sheet.getCell(row, 1).font = { name: "Arial", size: 9, color: { argb: "FF475569" } };
    });
    sheet.getCell(4, 1).font = { name: "Arial", size: 16, bold: true, color: { argb: "FF17365D" } };
    sheet.getCell(4, 1).alignment = { horizontal: "center", vertical: "middle" };
    sheet.getCell(5, 1).font = { name: "Arial", size: 11, italic: true, color: { argb: "FF475569" } };
    sheet.getCell(5, 1).alignment = { horizontal: "center", vertical: "middle" };
    sheet.getRow(4).height = 28;
    sheet.getRow(5).height = 20;
    sheet.getRow(6).height = remainingLegendColumns < 12 ? 82 : 58;
    sheet.getRow(7).height = 20;
    sheet.getRow(8).height = 20;
    sheet.pageSetup.printArea = `A1:${lastColumnLetter}${noteRow}`;

    return workbook;
}

const downloadWorkbook = async (
    workbook: ExcelJS.Workbook,
    filename: string,
) => {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
};

const logAttendanceExport = async (input: AttendanceExportInput) => {
    try {
        await fetch(`${API_BASE_URL}/api/audit-logs/export`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
                entity_type: "attendance_logs",
                warehouse_id: input.warehouseId,
                filters: {
                    date_from: input.days[0]?.key,
                    date_to: input.days.at(-1)?.key,
                },
            }),
        });
    } catch (error) {
        console.error("Failed to log attendance export", error);
    }
};

export function buildTimeAttendanceExportConfig(
    input: AttendanceExportInput,
): CustomExportConfig {
    return {
        entityType: "attendance_logs",
        warehouseId: input.warehouseId,
        execute: async () => {
            const workbook = buildTimeAttendanceWorkbook(input);
            const firstDate = input.days[0]?.key || "khong-xac-dinh";
            const lastDate = input.days.at(-1)?.key || firstDate;
            await Promise.all([
                downloadWorkbook(
                    workbook,
                    `bang_cham_cong_${firstDate}_${lastDate}.xlsx`,
                ),
                logAttendanceExport(input),
            ]);
        },
    };
}
