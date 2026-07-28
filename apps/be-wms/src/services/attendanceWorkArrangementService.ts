import {
  AttendanceLocationRule,
  AttendanceWorkArrangementStatus,
  AuditAction,
  type AttendanceWorkArrangement,
  type AttendanceWorkArrangementType,
  type User,
} from "@bduck/shared-types";
import {
  cancelAttendanceWorkArrangement as cancelAttendanceWorkArrangementRecord,
  createAttendanceWorkArrangement,
  listAttendanceWorkArrangements,
} from "../repositories/attendanceRepository.js";
import { getEmployeeProfileByUserId } from "../repositories/employeeProfileRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

type RequestUser = Pick<User, "id">;

const createApiError = (
  statusCode: number,
  vi: string,
  zh: string,
  data?: unknown,
) => ({
  statusCode,
  messages: { vi, zh },
  data,
});

export interface AttendanceWorkArrangementInput {
  user_id: string;
  type: AttendanceWorkArrangementType;
  start_date: string;
  end_date: string;
  location_rule: AttendanceLocationRule;
  destination_name?: string | null;
  destination_coordinate?: { latitude: number; longitude: number } | null;
  radius_m?: number | null;
  reason: string;
}

export const fetchAttendanceWorkArrangements = (warehouseId: string) =>
  listAttendanceWorkArrangements(warehouseId);

export const approveAttendanceWorkArrangement = async (
  user: RequestUser,
  warehouseId: string,
  input: AttendanceWorkArrangementInput,
  auditMetadata?: AuditMetadata,
): Promise<AttendanceWorkArrangement> => {
  if (user.id === input.user_id) {
    throw createApiError(
      403,
      "Người tạo cấu hình không được tự phê duyệt lịch công tác hoặc WFH của chính mình.",
      "配置创建者不得自行批准本人的出差或居家办公安排。",
    );
  }
  const profile = await getEmployeeProfileByUserId(input.user_id);
  if (!profile || profile.workplace_warehouse_id !== warehouseId) {
    throw createApiError(
      400,
      "Nhân viên không thuộc cơ sở đã chọn.",
      "该员工不属于所选工作地点。",
    );
  }
  const existing = await listAttendanceWorkArrangements(warehouseId);
  const overlaps = existing.some(
    (item) =>
      item.user_id === input.user_id &&
      item.status === AttendanceWorkArrangementStatus.APPROVED &&
      item.start_date <= input.end_date &&
      item.end_date >= input.start_date,
  );
  if (overlaps) {
    throw createApiError(
      409,
      "Nhân viên đã có lịch công tác/WFH được duyệt trong khoảng ngày này.",
      "该员工在所选日期范围内已有获批的出差/居家办公安排。",
    );
  }

  const now = new Date();
  const arrangement = await createAttendanceWorkArrangement({
    warehouse_id: warehouseId,
    user_id: input.user_id,
    employee_profile_id: profile.id,
    employee_id: profile.employee_code,
    employee_name: profile.full_name,
    type: input.type,
    start_date: input.start_date,
    end_date: input.end_date,
    location_rule: input.location_rule,
    destination_name: input.destination_name?.trim() || null,
    destination_coordinate: input.destination_coordinate || null,
    radius_m: input.radius_m || null,
    reason: input.reason.trim(),
    status: AttendanceWorkArrangementStatus.APPROVED,
    requested_by: input.user_id,
    approved_by: user.id,
    approved_at: now,
    cancelled_by: null,
    cancelled_at: null,
    created_at: now,
    updated_at: now,
    is_deleted: false,
  });

  await logAudit({
    entity_type: "attendance_work_arrangements",
    entity_id: arrangement.id,
    warehouse_id: warehouseId,
    action: AuditAction.APPROVE,
    user_id: user.id,
    old_value: null,
    new_value: arrangement as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  return arrangement;
};

export const cancelAttendanceWorkArrangement = async (
  user: RequestUser,
  warehouseId: string,
  arrangementId: string,
  auditMetadata?: AuditMetadata,
) => {
  const oldArrangement = (await listAttendanceWorkArrangements(warehouseId)).find(
    (item) => item.id === arrangementId,
  );
  if (!oldArrangement) {
    throw createApiError(404, "Không tìm thấy cấu hình.", "未找到该安排。");
  }
  const arrangement = await cancelAttendanceWorkArrangementRecord(
    arrangementId,
    user.id,
  );
  if (!arrangement) {
    throw createApiError(404, "Không tìm thấy cấu hình.", "未找到该安排。");
  }
  await logAudit({
    entity_type: "attendance_work_arrangements",
    entity_id: arrangement.id,
    warehouse_id: warehouseId,
    action: AuditAction.CANCEL,
    user_id: user.id,
    old_value: oldArrangement as unknown as Record<string, unknown>,
    new_value: arrangement as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
  return arrangement;
};
