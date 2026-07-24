import type { Request, Response } from "express";
import { z } from "zod";
import {
  adjustEmployeeLeaveBalance,
  fetchCompanyLeavePolicy,
  fetchCompanyLeaveRequests,
  fetchEmployeeLeaveBalance,
  fetchLeaveBalanceAdjustmentProfiles,
  updateCompanyLeavePolicy,
} from "../../services/leaveAdministrationService.js";
import { mapFirebaseError } from "../../utils/firebaseErrorHandler.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const safeText = z
  .string()
  .trim()
  .min(3)
  .max(1000)
  .refine((value) => !/\$(?:where|ne|gt|gte|lt|lte|in|nin)\b/i.test(value));

const halfUnit = z
  .number()
  .finite()
  .refine((value) => Math.round(value * 2) === value * 2);

const policySchema = z
  .object({
    monthly_accrual_units: halfUnit.min(0.5).max(31),
    annual_cap_units: halfUnit.min(1).max(365),
    action_time: z.coerce.date(),
  })
  .strict();

const adjustmentSchema = z
  .object({
    idempotency_key: z
      .string()
      .trim()
      .min(8)
      .max(100)
      .regex(/^[A-Za-z0-9:_-]+$/),
    leave_year: z.number().int().min(2000).max(2100),
    posting_date: z.string().date(),
    available_units_delta: halfUnit
      .min(-365)
      .max(365)
      .refine((value) => value !== 0),
    reason: safeText,
    action_time: z.coerce.date(),
  })
  .strict();

const profileIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);

const handleError = (res: Response, error: unknown) => {
  console.error("[leaveAdministrationController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu quản trị ngày phép không hợp lệ.",
        zh: "假期管理数据无效。",
      },
      400,
      error.flatten(),
    );
  }
  const firebaseMapped = mapFirebaseError(error);
  if (firebaseMapped) {
    return sendError(res, firebaseMapped.messages, firebaseMapped.statusCode);
  }
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  return sendError(
    res,
    apiError.messages ?? {
      vi: "Không thể xử lý chức năng quản trị ngày phép.",
      zh: "无法处理假期管理功能。",
    },
    apiError.statusCode ?? 500,
  );
};

export const getLeavePolicyHandler = async (req: Request, res: Response) => {
  try {
    const data = await fetchCompanyLeavePolicy(
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải chính sách ngày phép.",
      zh: "假期政策已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const putLeavePolicyHandler = async (req: Request, res: Response) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    const data = await updateCompanyLeavePolicy(
      policySchema.parse(req.body),
      actor.id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã cập nhật chính sách ngày phép.",
      zh: "假期政策已更新。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listCompanyLeaveRequestsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = await fetchCompanyLeaveRequests(
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải danh sách đơn nghỉ phép.",
      zh: "休假申请列表已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listLeaveBalanceProfilesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = await fetchLeaveBalanceAdjustmentProfiles(
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải danh sách nhân viên.",
      zh: "员工列表已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getEmployeeLeaveBalanceHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = await fetchEmployeeLeaveBalance(
      profileIdSchema.parse(req.params.profileId),
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải số dư ngày phép của nhân viên.",
      zh: "员工假期余额已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const postLeaveBalanceAdjustmentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    const data = await adjustEmployeeLeaveBalance(
      profileIdSchema.parse(req.params.profileId),
      adjustmentSchema.parse(req.body),
      actor.id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã điều chỉnh số dư ngày phép.",
      zh: "假期余额已调整。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
