import {
  AttendanceLogStatus,
  AttendanceLateReportStatus,
  AttendanceRejectedReason,
  AuditAction,
  type AttendanceCheckInContext,
  type AttendanceLateReport,
  type AttendanceLog,
  type EmployeeProfile,
  type User,
  type UserWarehouseRole,
  type WarehouseAttendancePolicy,
} from "@bduck/shared-types";
import {
  createAttendanceLog,
  createAttendanceLateReport,
  createSuccessAttendanceLogOnce,
  getActiveAttendancePolicy,
  getTodaySuccessAttendanceLog,
  listActiveAttendanceExemptions,
  listActiveAttendancePolicies,
  replaceActiveAttendancePolicy,
  replaceAttendanceExemptions,
} from "../repositories/attendanceRepository.js";
import { getEmployeeProfileByUserId } from "../repositories/employeeProfileRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";

const TIMEZONE = "Asia/Ho_Chi_Minh" as const;

interface RequestUser extends User {
  permissions?: Record<string, Record<string, unknown>>;
  roleAssignments?: UserWarehouseRole[];
}

const permissionAllowed = (
  user: RequestUser,
  action: string,
  warehouseId?: string | null,
) => {
  const permissions = user.permissions || {};
  const globalPerms = permissions.global || {};
  if (globalPerms["*"] === true || globalPerms[action] === true) return true;

  if (warehouseId) {
    const scoped = permissions[warehouseId] || {};
    return scoped["*"] === true || scoped[action] === true;
  }

  return Object.entries(permissions).some(([scope, scoped]) => {
    if (scope === "global") return false;
    return scoped["*"] === true || scoped[action] === true;
  });
};

const accessibleWarehouseIdsForAction = (
  user: RequestUser,
  action: string,
): string[] | undefined => {
  const permissions = user.permissions || {};
  const globalPerms = permissions.global || {};
  if (globalPerms["*"] === true || globalPerms[action] === true)
    return undefined;

  return Object.entries(permissions)
    .filter(
      ([scope, scoped]) =>
        scope !== "global" && (scoped["*"] === true || scoped[action] === true),
    )
    .map(([scope]) => scope);
};

const getVietnamDateKey = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const value = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
};

const normalizeIp = (ip: string | null | undefined) => {
  if (!ip) return null;
  const cleaned = ip.trim().replace(/^"|"$/g, "");
  return cleaned.replace(/^::ffff:/, "") || null;
};

const normalizeIpCandidates = (
  input: string | Array<string | null | undefined> | null | undefined,
) => {
  const rawItems = Array.isArray(input) ? input : [input];
  const seen = new Set<string>();
  const candidates: string[] = [];

  for (const item of rawItems) {
    if (!item) continue;
    for (const part of item.split(",")) {
      const normalized = normalizeIp(part);
      if (!normalized || seen.has(normalized)) continue;
      seen.add(normalized);
      candidates.push(normalized);
    }
  }

  return candidates;
};

const getMatchingPolicyIp = (
  requestIps: string[],
  policyIps: string[] | undefined,
) => {
  const allowedIps = new Set(
    (policyIps || [])
      .map((ip) => normalizeIp(ip))
      .filter((ip): ip is string => Boolean(ip)),
  );
  return requestIps.find((ip) => allowedIps.has(ip)) || null;
};

const isCompanyNetwork = (
  requestIps: string[],
  policy: WarehouseAttendancePolicy | null,
) => {
  if (!policy?.enabled) return null;
  return Boolean(getMatchingPolicyIp(requestIps, policy.ip_addresses));
};

const isAttendanceRequired = async (userId: string, warehouseId: string) => {
  const exemptions = await listActiveAttendanceExemptions(warehouseId);
  return !exemptions.some(
    (item) => item.user_id === userId && item.attendance_required === false,
  );
};

const buildLog = (
  user: RequestUser,
  profile: EmployeeProfile,
  warehouseId: string,
  policy: WarehouseAttendancePolicy | null,
  status: AttendanceLogStatus,
  rejectedReason: AttendanceRejectedReason | null,
  ipAddress: string | null,
  actionTime: Date,
): Omit<AttendanceLog, "id"> => {
  const syncTime = new Date();
  return {
    user_id: user.id,
    employee_profile_id: profile.id,
    employee_id: profile.employee_code,
    employee_name: profile.full_name,
    warehouse_id: warehouseId,
    policy_id: policy?.id || null,
    attendance_date: getVietnamDateKey(actionTime),
    timezone: TIMEZONE,
    check_in_at: actionTime,
    action_time: actionTime,
    sync_time: syncTime,
    ip_address: ipAddress,
    status,
    rejected_reason: rejectedReason,
  };
};

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

const auditAttendanceLog = async (
  log: AttendanceLog,
  actorId: string,
  auditMetadata?: AuditMetadata,
) => {
  await logAudit({
    entity_type: "attendance_logs",
    entity_id: log.id,
    warehouse_id: log.warehouse_id,
    action: AuditAction.CREATE,
    user_id: actorId,
    old_value: null,
    new_value: log as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
};

export const fetchAttendanceContext = async (
  user: RequestUser,
  requestIpInput?: string | Array<string | null | undefined> | null,
): Promise<AttendanceCheckInContext> => {
  const requestIps = normalizeIpCandidates(requestIpInput);
  const currentIpAddress = requestIps[0] ?? null;
  const profile = await getEmployeeProfileByUserId(user.id);
  const warehouseId = profile?.workplace_warehouse_id ?? null;
  const canViewAttendance = permissionAllowed(user, "attendance.view");
  const hasCheckInPermission = permissionAllowed(
    user,
    "attendance.check_in",
    warehouseId,
  );
  const canConfigureAttendance = permissionAllowed(user, "attendance.config");
  const canExportAttendance = permissionAllowed(user, "attendance.export");

  if (!profile || !warehouseId) {
    return {
      can_access_page:
        hasCheckInPermission ||
        canViewAttendance ||
        canConfigureAttendance ||
        canExportAttendance,
      can_check_in: false,
      can_view_attendance: canViewAttendance,
      can_configure_attendance: canConfigureAttendance,
      can_export_attendance: canExportAttendance,
      warehouse_id: null,
      policy: null,
      today_success_log: null,
      current_ip_address: currentIpAddress,
      is_company_network: null,
      messages: {
        vi: "Tài khoản chưa có một nơi làm việc duy nhất để chấm công.",
        zh: "账号尚未配置唯一的考勤工作地点。",
      },
    };
  }

  const [policy, attendanceRequired] = await Promise.all([
    getActiveAttendancePolicy(warehouseId),
    isAttendanceRequired(user.id, warehouseId),
  ]);
  const todaySuccessLog = await getTodaySuccessAttendanceLog(
    user.id,
    getVietnamDateKey(),
  );
  const canCheckIn = Boolean(
    hasCheckInPermission && policy?.enabled && attendanceRequired,
  );

  return {
    can_access_page:
      hasCheckInPermission ||
      canViewAttendance ||
      canConfigureAttendance ||
      canExportAttendance,
    can_check_in: canCheckIn,
    can_view_attendance: canViewAttendance,
    can_configure_attendance: canConfigureAttendance,
    can_export_attendance: canExportAttendance,
    warehouse_id: warehouseId,
    policy,
    today_success_log: todaySuccessLog,
    current_ip_address: currentIpAddress,
    is_company_network: isCompanyNetwork(requestIps, policy),
  };
};

export const checkInAttendance = async (
  user: RequestUser,
  input: { action_time?: string },
  requestIpInput: string | Array<string | null | undefined> | null | undefined,
  auditMetadata?: AuditMetadata,
): Promise<AttendanceLog> => {
  const profile = await getEmployeeProfileByUserId(user.id);
  const warehouseId = profile?.workplace_warehouse_id ?? null;
  const requestIps = normalizeIpCandidates(requestIpInput);
  const ipAddress = requestIps[0] ?? null;
  const actionTime = input.action_time
    ? new Date(input.action_time)
    : new Date();

  if (!profile || !warehouseId) {
    throw createApiError(
      400,
      "Tài khoản chưa có một nơi làm việc duy nhất để chấm công.",
      "账号尚未配置唯一的考勤工作地点。",
    );
  }

  if (!permissionAllowed(user, "attendance.check_in", warehouseId)) {
    throw createApiError(
      403,
      "Bạn không có quyền sử dụng chức năng check-in.",
      "您无权使用打卡功能。",
    );
  }

  const policy = await getActiveAttendancePolicy(warehouseId);
  const attendanceRequired = await isAttendanceRequired(user.id, warehouseId);

  if (!policy?.enabled) {
    const log = await createAttendanceLog(
      buildLog(
        user,
        profile,
        warehouseId,
        policy,
        AttendanceLogStatus.REJECTED,
        AttendanceRejectedReason.POLICY_DISABLED,
        ipAddress,
        actionTime,
      ),
    );
    await auditAttendanceLog(log, user.id, auditMetadata);
    throw createApiError(
      403,
      "Kho hiện chưa bật chấm công.",
      "该仓库尚未启用考勤。",
      log,
    );
  }

  if (!attendanceRequired) {
    throw createApiError(
      403,
      "Tài khoản của bạn không thuộc diện cần chấm công.",
      "您的账号不需要考勤。",
    );
  }

  const existing = await getTodaySuccessAttendanceLog(
    user.id,
    getVietnamDateKey(actionTime),
  );
  if (existing) {
    throw createApiError(
      409,
      "Bạn đã check-in hôm nay.",
      "您今天已经打卡。",
      existing,
    );
  }

  const matchedIp = getMatchingPolicyIp(requestIps, policy.ip_addresses);

  if (!matchedIp) {
    const log = await createAttendanceLog(
      buildLog(
        user,
        profile,
        warehouseId,
        policy,
        AttendanceLogStatus.REJECTED,
        AttendanceRejectedReason.INVALID_IP,
        ipAddress,
        actionTime,
      ),
    );
    await auditAttendanceLog(log, user.id, auditMetadata);
    throw createApiError(
      403,
      "Bạn đang không dùng mạng công ty. Vui lòng kết nối mạng công ty để check-in.",
      "您当前未使用公司网络，请连接公司网络后再打卡。",
      log,
    );
  }

  const { log, existing: duplicate } = await createSuccessAttendanceLogOnce(
    buildLog(
      user,
      profile,
      warehouseId,
      policy,
      AttendanceLogStatus.SUCCESS,
      null,
      matchedIp,
      actionTime,
    ),
  );

  if (duplicate) {
    throw createApiError(
      409,
      "Bạn đã check-in hôm nay.",
      "您今天已经打卡。",
      duplicate,
    );
  }

  await auditAttendanceLog(log, user.id, auditMetadata);
  return log;
};

export const createLateArrivalReport = async (
  user: RequestUser,
  input: {
    attendance_date?: string;
    expected_arrival_time?: string | null;
    estimated_arrival_time?: string | null;
    reason: string;
    action_time?: string;
  },
  auditMetadata?: AuditMetadata,
): Promise<AttendanceLateReport> => {
  const profile = await getEmployeeProfileByUserId(user.id);
  const warehouseId = profile?.workplace_warehouse_id ?? null;
  const actionTime = input.action_time
    ? new Date(input.action_time)
    : new Date();
  const attendanceDate = input.attendance_date || getVietnamDateKey(actionTime);

  if (!profile || !warehouseId) {
    throw createApiError(
      400,
      "Tài khoản chưa có một nơi làm việc duy nhất để báo đến trễ.",
      "账号尚未配置唯一的考勤工作地点，无法报告迟到。",
    );
  }

  if (!permissionAllowed(user, "attendance.check_in", warehouseId)) {
    throw createApiError(
      403,
      "Bạn không có quyền sử dụng chức năng báo đến trễ.",
      "您无权使用迟到报告功能。",
    );
  }

  const attendanceRequired = await isAttendanceRequired(user.id, warehouseId);
  if (!attendanceRequired) {
    throw createApiError(
      403,
      "Tài khoản của bạn không thuộc diện cần chấm công.",
      "您的账号不需要考勤。",
    );
  }

  const todayLog = await getTodaySuccessAttendanceLog(user.id, attendanceDate);
  const now = new Date();
  const report = await createAttendanceLateReport({
    user_id: user.id,
    employee_profile_id: profile.id,
    employee_id: profile.employee_code,
    employee_name: profile.full_name,
    warehouse_id: warehouseId,
    attendance_date: attendanceDate,
    timezone: TIMEZONE,
    expected_arrival_time: input.expected_arrival_time || null,
    estimated_arrival_time: input.estimated_arrival_time || null,
    reason: input.reason.trim(),
    attendance_log_id: todayLog?.id || null,
    status: AttendanceLateReportStatus.SUBMITTED,
    action_time: actionTime,
    sync_time: now,
    created_at: now,
    updated_at: now,
    created_by: user.id,
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
  });

  await logAudit({
    entity_type: "attendance_late_reports",
    entity_id: report.id,
    warehouse_id: warehouseId,
    action: AuditAction.CREATE,
    user_id: user.id,
    old_value: null,
    new_value: report as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return report;
};

export const fetchAttendancePolicies = async (user: RequestUser) =>
  listActiveAttendancePolicies(
    accessibleWarehouseIdsForAction(user, "attendance.config"),
  );

export const updateAttendancePolicy = async (
  user: RequestUser,
  warehouseId: string,
  input: { enabled: boolean; ip_addresses: string[] },
  auditMetadata?: AuditMetadata,
) => {
  if (!permissionAllowed(user, "attendance.config", warehouseId)) {
    throw createApiError(
      403,
      "Bạn không có quyền cấu hình kho này.",
      "您无权配置该仓库。",
    );
  }

  const oldPolicy = await getActiveAttendancePolicy(warehouseId);
  const policy = await replaceActiveAttendancePolicy(warehouseId, {
    enabled: input.enabled,
    ip_addresses: Array.from(
      new Set(
        input.ip_addresses
          .map((ip) => normalizeIp(ip))
          .filter((ip): ip is string => Boolean(ip)),
      ),
    ),
    actorId: user.id,
  });

  await logAudit({
    entity_type: "warehouse_attendance_policies",
    entity_id: policy.id,
    warehouse_id: warehouseId,
    action: oldPolicy ? AuditAction.UPDATE : AuditAction.CREATE,
    user_id: user.id,
    old_value: oldPolicy as unknown as Record<string, unknown> | null,
    new_value: policy as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return policy;
};

export const fetchAttendanceExemptions = async (
  user: RequestUser,
  warehouseId: string,
) => {
  if (!permissionAllowed(user, "attendance.config", warehouseId)) {
    throw createApiError(
      403,
      "Bạn không có quyền xem cấu hình kho này.",
      "您无权查看该仓库配置。",
    );
  }

  return listActiveAttendanceExemptions(warehouseId);
};

export const updateAttendanceExemptions = async (
  user: RequestUser,
  warehouseId: string,
  excludedUserIds: string[],
  auditMetadata?: AuditMetadata,
) => {
  if (!permissionAllowed(user, "attendance.config", warehouseId)) {
    throw createApiError(
      403,
      "Bạn không có quyền cấu hình kho này.",
      "您无权配置该仓库。",
    );
  }

  const oldExemptions = await listActiveAttendanceExemptions(warehouseId);
  const exemptions = await replaceAttendanceExemptions(
    warehouseId,
    excludedUserIds,
    user.id,
  );

  await logAudit({
    entity_type: "warehouse_attendance_exemptions",
    entity_id: warehouseId,
    warehouse_id: warehouseId,
    action: AuditAction.UPDATE,
    user_id: user.id,
    old_value: { exemptions: oldExemptions },
    new_value: { exemptions },
    ...auditMetadata,
  });

  return exemptions;
};
