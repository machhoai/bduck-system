import {
  ExpenseCategory,
  ExpenseCostCenter,
  ExpenseItemSchema,
} from "@bduck/shared-types";
import type { Request, Response } from "express";
import { z } from "zod";
import * as expenseService from "../../services/scopedExpenseService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const periodSchema = z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/);
const facilityPeriodSchema = z.object({
  warehouseId: z.string().uuid(),
  period: periodSchema,
});
const readPeriodSchema = facilityPeriodSchema.extend({
  warehouseId: z.union([z.string().uuid(), z.literal("ALL")]),
});
const categoryParamSchema = facilityPeriodSchema.extend({
  category: z.nativeEnum(ExpenseCategory),
});
const customItemParamSchema = facilityPeriodSchema.extend({
  itemId: z.string().uuid(),
});
const updateItemBodySchema = ExpenseItemSchema.partial().omit({
  suggested_amount: true,
});
const saveCustomItemBodySchema = z.object({
  label: z.string().trim().min(1).max(100),
  cost_center: z.nativeEnum(ExpenseCostCenter),
  actual_amount: z.number().min(0),
  budget_amount: z.number().min(0).nullable(),
  note: z.string().trim().max(1000).nullable().optional(),
});

const handleExpenseError = (res: Response, error: unknown): void => {
  console.error("[expenseController] error:", error);
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  sendError(
    res,
    apiError.messages ?? {
      vi: "Lỗi khi xử lý chi phí.",
      zh: "处理费用时出错。",
    },
    error instanceof z.ZodError ? 400 : (apiError.statusCode ?? 500),
    error instanceof z.ZodError ? error.flatten() : undefined,
  );
};

export const getExpenseHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { warehouseId, period } = readPeriodSchema.parse(req.params);
    const user = requireAuthenticatedRequestUser(req);
    const data = await expenseService.getExpenseData(
      warehouseId,
      period,
      user.id,
      requireRequestAuthorization(req),
    );
    sendSuccess(res, data, {
      vi: "Lấy dữ liệu chi phí thành công.",
      zh: "成功获取费用数据。",
    });
  } catch (error) {
    handleExpenseError(res, error);
  }
};

export const getDashboardHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { warehouseId, period } = readPeriodSchema.parse(req.params);
    const data = await expenseService.getExpenseDashboard(
      warehouseId,
      period,
      requireRequestAuthorization(req),
    );
    sendSuccess(res, data, {
      vi: "Lấy dữ liệu dashboard thành công.",
      zh: "成功获取仪表盘数据。",
    });
  } catch (error) {
    handleExpenseError(res, error);
  }
};

export const updateItemHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { warehouseId, period, category } = categoryParamSchema.parse(
      req.params,
    );
    const user = requireAuthenticatedRequestUser(req);
    const data = await expenseService.updateExpenseItem(
      warehouseId,
      period,
      category,
      updateItemBodySchema.parse(req.body),
      user.id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    sendSuccess(res, data, {
      vi: "Cập nhật chi phí thành công.",
      zh: "成功更新费用。",
    });
  } catch (error) {
    handleExpenseError(res, error);
  }
};

export const saveCustomItemHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { warehouseId, period, itemId } = customItemParamSchema.parse(
      req.params,
    );
    const user = requireAuthenticatedRequestUser(req);
    const data = await expenseService.saveCustomExpenseItem(
      warehouseId,
      period,
      itemId,
      saveCustomItemBodySchema.parse(req.body),
      user.id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    sendSuccess(res, data, {
      vi: "Lưu mục chi phí tùy chỉnh thành công.",
      zh: "成功保存自定义费用项。",
    });
  } catch (error) {
    handleExpenseError(res, error);
  }
};

export const deleteCustomItemHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { warehouseId, period, itemId } = customItemParamSchema.parse(
      req.params,
    );
    const user = requireAuthenticatedRequestUser(req);
    const data = await expenseService.deleteCustomExpenseItem(
      warehouseId,
      period,
      itemId,
      user.id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    sendSuccess(res, data, {
      vi: "Xóa mềm mục chi phí tùy chỉnh thành công.",
      zh: "成功软删除自定义费用项。",
    });
  } catch (error) {
    handleExpenseError(res, error);
  }
};

const changePeriodStatus = async (
  req: Request,
  res: Response,
  mode: "close" | "reopen",
): Promise<void> => {
  try {
    const { warehouseId, period } = facilityPeriodSchema.parse(req.params);
    const user = requireAuthenticatedRequestUser(req);
    const authorization = requireRequestAuthorization(req);
    const metadata = getAuditRequestMetadata(req);
    const data =
      mode === "close"
        ? await expenseService.closePeriod(
            warehouseId,
            period,
            user.id,
            authorization,
            metadata,
          )
        : await expenseService.reopenPeriod(
            warehouseId,
            period,
            user.id,
            authorization,
            metadata,
          );
    sendSuccess(
      res,
      data,
      mode === "close"
        ? { vi: "Chốt kỳ kế toán thành công.", zh: "成功结账。" }
        : {
            vi: "Đã mở lại kỳ kế toán thành công.",
            zh: "成功重新开放会计期间。",
          },
    );
  } catch (error) {
    handleExpenseError(res, error);
  }
};

export const closePeriodHandler = (req: Request, res: Response) =>
  changePeriodStatus(req, res, "close");

export const reopenPeriodHandler = (req: Request, res: Response) =>
  changePeriodStatus(req, res, "reopen");
