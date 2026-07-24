import type { Request, Response } from "express";
import { z } from "zod";
import {
  createCompanyHoliday,
  fetchCompanyHolidays,
  removeCompanyHoliday,
} from "../../services/leaveHolidayService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const safeText = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .refine((value) => !/\$(where|ne|gt|lt)\b/i.test(value));
const yearSchema = z.coerce.number().int().min(2000).max(2100);
const holidaySchema = z
  .object({
    holiday_date: z.string().date(),
    name: z.object({ vi: safeText, zh: safeText }).strict(),
    action_time: z.coerce.date(),
  })
  .strict();
const deleteSchema = z
  .object({ action_time: z.coerce.date() })
  .strict();

const handleError = (res: Response, error: unknown) => {
  console.error("[leaveHolidayController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu ngày lễ không hợp lệ.", zh: "节假日数据无效。" },
      400,
      error.flatten(),
    );
  }
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  return sendError(
    res,
    apiError.messages ?? {
      vi: "Không thể xử lý ngày lễ.",
      zh: "无法处理节假日。",
    },
    apiError.statusCode ?? 500,
  );
};

export const listCompanyHolidaysHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const year = yearSchema.parse(req.query.year);
    const data = await fetchCompanyHolidays(
      year,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải danh sách ngày lễ.",
      zh: "节假日列表已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const createCompanyHolidayHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    const data = await createCompanyHoliday(
      holidaySchema.parse(req.body),
      actor.id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(
      res,
      data,
      { vi: "Đã thêm ngày lễ.", zh: "节假日已添加。" },
      201,
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const deleteCompanyHolidayHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    const input = deleteSchema.parse(req.body);
    const data = await removeCompanyHoliday(
      z.string().min(1).parse(req.params.id),
      actor.id,
      input.action_time,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã ngừng áp dụng ngày lễ.",
      zh: "节假日已停用。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
