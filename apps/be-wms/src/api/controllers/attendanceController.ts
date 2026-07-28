import type { Request, Response } from "express";
import { z } from "zod";
import {
  AttendanceLocationRule,
  AttendanceVerificationStrategy,
  AttendanceWorkArrangementType,
} from "@bduck/shared-types";
import {
  approveAttendanceWorkArrangement,
  cancelAttendanceWorkArrangement,
  checkInAttendance,
  createLateArrivalReport,
  fetchAttendanceContext,
  fetchAttendanceExemptions,
  fetchAttendancePolicies,
  fetchAttendanceWorkArrangements,
  updateAttendanceExemptions,
  updateAttendancePolicy,
} from "../../services/scopedAttendanceService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const warehouseParamSchema = z.object({ warehouseId: z.string().uuid() });
const checkInSchema = z.object({
  action_time: z.string().datetime().optional(),
  location: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      accuracy_m: z.number().positive().max(10_000),
      captured_at: z.string().datetime(),
    })
    .optional(),
});
const unsafeQueryOperatorPattern = /\$(where|ne|gt|gte|lt|lte|regex|in|nin)/i;
const lateArrivalReportSchema = z.object({
  attendance_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  expected_arrival_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  estimated_arrival_time: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  reason: z
    .string()
    .trim()
    .min(4)
    .max(500)
    .refine((value) => !unsafeQueryOperatorPattern.test(value)),
  action_time: z.string().datetime().optional(),
});
const updatePolicySchema = z.object({
  enabled: z.boolean(),
  ip_addresses: z
    .array(
      z
        .string()
        .trim()
        .min(1)
        .max(64)
        .regex(/^[0-9a-fA-F:.]+$/),
    )
    .max(20)
    .default([]),
  verification_strategy: z.nativeEnum(AttendanceVerificationStrategy),
  gps_radius_m: z.number().int().min(20).max(5_000),
  gps_max_accuracy_m: z.number().int().min(10).max(1_000),
  gps_max_age_seconds: z.number().int().min(30).max(900),
  allow_business_trip: z.boolean(),
  allow_work_from_home: z.boolean(),
});
const updateExemptionsSchema = z.object({
  excluded_user_ids: z
    .array(z.string().trim().min(1).max(128))
    .max(500)
    .default([]),
});
const arrangementParamSchema = warehouseParamSchema.extend({
  arrangementId: z.string().uuid(),
});
const workArrangementSchema = z
  .object({
    user_id: z.string().trim().min(1).max(128),
    type: z.nativeEnum(AttendanceWorkArrangementType),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    location_rule: z.nativeEnum(AttendanceLocationRule),
    destination_name: z.string().trim().max(200).nullable().optional(),
    destination_coordinate: z
      .object({
        latitude: z.number().min(-90).max(90),
        longitude: z.number().min(-180).max(180),
      })
      .nullable()
      .optional(),
    radius_m: z.number().int().min(20).max(5_000).nullable().optional(),
    reason: z
      .string()
      .trim()
      .min(4)
      .max(500)
      .refine((value) => !unsafeQueryOperatorPattern.test(value)),
  })
  .refine((value) => value.start_date <= value.end_date, {
    message: "end_date must be on or after start_date",
    path: ["end_date"],
  })
  .refine(
    (value) =>
      value.location_rule !== AttendanceLocationRule.GEOFENCE ||
      Boolean(value.destination_coordinate),
    {
      message: "destination_coordinate is required for geofence",
      path: ["destination_coordinate"],
    },
  );

const getRequestUser = (req: Request) => requireAuthenticatedRequestUser(req);
const getHeaderValue = (req: Request, headerName: string) => {
  const value = req.headers[headerName.toLowerCase()];
  return Array.isArray(value) ? value.join(",") : value;
};

const getRequestIpCandidates = (req: Request) => [
  getHeaderValue(req, "cf-connecting-ip"),
  getHeaderValue(req, "x-real-ip"),
  getHeaderValue(req, "x-forwarded-for"),
  req.socket.remoteAddress,
  req.ip,
];

const handleAttendanceError = (res: Response, error: unknown) => {
  console.error("[attendanceController] error:", error);

  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu chấm công không hợp lệ.", zh: "考勤数据无效。" },
      400,
      error.flatten(),
    );
  }

  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
    data?: unknown;
  };
  if (apiError.statusCode && apiError.messages) {
    return sendError(
      res,
      apiError.messages,
      apiError.statusCode,
      apiError.data ?? null,
    );
  }

  return sendError(
    res,
    { vi: "Lỗi khi xử lý chấm công.", zh: "处理考勤时出错。" },
    500,
  );
};

export const getAttendanceContextHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const context = await fetchAttendanceContext(
      getRequestUser(req),
      getRequestIpCandidates(req),
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, context, {
      vi: "Lấy ngữ cảnh chấm công thành công.",
      zh: "成功获取考勤上下文。",
    });
  } catch (error) {
    return handleAttendanceError(res, error);
  }
};

export const checkInAttendanceHandler = async (req: Request, res: Response) => {
  try {
    const input = checkInSchema.parse(req.body || {});
    const log = await checkInAttendance(
      getRequestUser(req),
      input,
      getRequestIpCandidates(req),
      getAuditRequestMetadata(req),
      requireRequestAuthorization(req),
    );
    return sendSuccess(
      res,
      log,
      { vi: "Check-in thành công.", zh: "打卡成功。" },
      201,
    );
  } catch (error) {
    return handleAttendanceError(res, error);
  }
};

export const createLateArrivalReportHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = lateArrivalReportSchema.parse(req.body || {});
    const report = await createLateArrivalReport(
      getRequestUser(req),
      input,
      getAuditRequestMetadata(req),
      requireRequestAuthorization(req),
    );
    return sendSuccess(
      res,
      report,
      { vi: "Đã ghi nhận báo đến trễ.", zh: "迟到报告已记录。" },
      201,
    );
  } catch (error) {
    return handleAttendanceError(res, error);
  }
};

export const getAttendancePoliciesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const policies = await fetchAttendancePolicies(
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, policies, {
      vi: "Lấy cấu hình chấm công thành công.",
      zh: "成功获取考勤配置。",
    });
  } catch (error) {
    return handleAttendanceError(res, error);
  }
};

export const updateAttendancePolicyHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { warehouseId } = warehouseParamSchema.parse(req.params);
    const input = updatePolicySchema.parse(req.body || {});
    const policy = await updateAttendancePolicy(
      getRequestUser(req),
      warehouseId,
      input,
      getAuditRequestMetadata(req),
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, policy, {
      vi: "Đã áp dụng cấu hình chấm công.",
      zh: "考勤配置已应用。",
    });
  } catch (error) {
    return handleAttendanceError(res, error);
  }
};

export const getAttendanceExemptionsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { warehouseId } = warehouseParamSchema.parse(req.params);
    const exemptions = await fetchAttendanceExemptions(
      getRequestUser(req),
      warehouseId,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, exemptions, {
      vi: "Lấy danh sách miễn chấm công thành công.",
      zh: "成功获取免考勤列表。",
    });
  } catch (error) {
    return handleAttendanceError(res, error);
  }
};

export const updateAttendanceExemptionsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { warehouseId } = warehouseParamSchema.parse(req.params);
    const input = updateExemptionsSchema.parse(req.body || {});
    const exemptions = await updateAttendanceExemptions(
      getRequestUser(req),
      warehouseId,
      input.excluded_user_ids,
      getAuditRequestMetadata(req),
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, exemptions, {
      vi: "Đã cập nhật danh sách miễn chấm công.",
      zh: "免考勤列表已更新。",
    });
  } catch (error) {
    return handleAttendanceError(res, error);
  }
};

export const getAttendanceWorkArrangementsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { warehouseId } = warehouseParamSchema.parse(req.params);
    const arrangements = await fetchAttendanceWorkArrangements(
      warehouseId,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, arrangements, {
      vi: "Lấy lịch công tác/WFH thành công.",
      zh: "成功获取出差/居家办公安排。",
    });
  } catch (error) {
    return handleAttendanceError(res, error);
  }
};

export const approveAttendanceWorkArrangementHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { warehouseId } = warehouseParamSchema.parse(req.params);
    const input = workArrangementSchema.parse(req.body || {});
    const arrangement = await approveAttendanceWorkArrangement(
      getRequestUser(req),
      warehouseId,
      input,
      getAuditRequestMetadata(req),
      requireRequestAuthorization(req),
    );
    return sendSuccess(
      res,
      arrangement,
      { vi: "Đã lưu và duyệt lịch làm việc.", zh: "工作安排已保存并批准。" },
      201,
    );
  } catch (error) {
    return handleAttendanceError(res, error);
  }
};

export const cancelAttendanceWorkArrangementHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { warehouseId, arrangementId } = arrangementParamSchema.parse(
      req.params,
    );
    const arrangement = await cancelAttendanceWorkArrangement(
      getRequestUser(req),
      warehouseId,
      arrangementId,
      getAuditRequestMetadata(req),
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, arrangement, {
      vi: "Đã hủy lịch làm việc.",
      zh: "工作安排已取消。",
    });
  } catch (error) {
    return handleAttendanceError(res, error);
  }
};
