/**
 * Expense Controller — REST Handlers
 *
 * ═══════════════════════════════════════════════════════════════
 * ENDPOINTS:
 * - GET  /:warehouseId/:period          → getExpenseHandler
 * - PUT  /:warehouseId/:period/items/:category → updateItemHandler
 * - POST /:warehouseId/:period/close    → closePeriodHandler
 *
 * DUAL-MATRIX RBAC:
 * - Read: expenses.read (own warehouse) or expenses.consolidated.view (ALL)
 * - Write: category-specific permissions (e.g. expenses.hr.write)
 * - Close: expenses.close_period
 * ═══════════════════════════════════════════════════════════════
 */

import type { Request, Response } from "express";
import { z } from "zod";
import {
  ExpenseCategory,
  ExpenseCostCenter,
  ExpenseItemSchema,
} from "@bduck/shared-types";
import {
  getExpenseData,
  updateExpenseItem,
  closePeriod,
} from "../../services/expenseService.js";
import { getDashboardMetrics } from "../../services/expenseDashboardService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

// ─────────────────────────────────────────────
// Zod Schemas for Request Validation
// ─────────────────────────────────────────────

const periodParamSchema = z.object({
  warehouseId: z.string().min(1),
  period: z.string().regex(/^\d{4}-(?:0[1-9]|1[0-2])$/, "YYYY-MM format"),
});

const categoryParamSchema = periodParamSchema.extend({
  category: z.nativeEnum(ExpenseCategory),
});

const updateItemBodySchema = ExpenseItemSchema.partial().omit({
  suggested_amount: true,
});

// ─────────────────────────────────────────────
// Cost Center → Permission Mapping
// ─────────────────────────────────────────────

const CATEGORY_TO_COST_CENTER: Record<ExpenseCategory, ExpenseCostCenter> = {
  [ExpenseCategory.RENT]: ExpenseCostCenter.OPERATIONS,
  [ExpenseCategory.ELECTRICITY]: ExpenseCostCenter.OPERATIONS,
  [ExpenseCategory.WATER]: ExpenseCostCenter.OPERATIONS,
  [ExpenseCategory.TRASH_COLLECTION]: ExpenseCostCenter.OPERATIONS,
  [ExpenseCategory.DRINKING_WATER]: ExpenseCostCenter.OPERATIONS,
  [ExpenseCategory.SOCIAL_INSURANCE]: ExpenseCostCenter.HR,
  [ExpenseCategory.SALARY_FULLTIME]: ExpenseCostCenter.HR,
  [ExpenseCategory.SALARY_PARTTIME]: ExpenseCostCenter.HR,
  [ExpenseCategory.MARKETING]: ExpenseCostCenter.MARKETING,
  [ExpenseCategory.GIFT_EXPENSE]: ExpenseCostCenter.MARKETING,
  [ExpenseCategory.COGS]: ExpenseCostCenter.MARKETING,
  [ExpenseCategory.CONSUMABLE_SUPPLIES]: ExpenseCostCenter.OTHERS,
  [ExpenseCategory.OTHERS]: ExpenseCostCenter.OTHERS,
};

const COST_CENTER_PERMISSION: Record<ExpenseCostCenter, string> = {
  [ExpenseCostCenter.OPERATIONS]: "expenses.operations.write",
  [ExpenseCostCenter.HR]: "expenses.hr.write",
  [ExpenseCostCenter.MARKETING]: "expenses.marketing.write",
  [ExpenseCostCenter.OTHERS]: "expenses.others.write",
};

function getRequiredPermission(category: ExpenseCategory): string {
  const costCenter = CATEGORY_TO_COST_CENTER[category];
  return COST_CENTER_PERMISSION[costCenter];
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const getRequestUserId = (req: Request): string =>
  (req as any).user?.id || "unknown";

function hasPermission(req: Request, action: string, warehouseId?: string): boolean {
  const user = (req as any).user;
  if (!user?.permissions) return false;

  const perms = user.permissions as Record<string, Record<string, unknown>>;
  const globalPerms = perms["global"] || {};

  if (globalPerms["*"] === true || globalPerms[action] === true) return true;

  if (warehouseId && warehouseId !== "ALL") {
    const whPerms = perms[warehouseId] || {};
    if (whPerms["*"] === true || whPerms[action] === true) return true;
  }

  return false;
}

// ─────────────────────────────────────────────
// Error Handler
// ─────────────────────────────────────────────

const handleExpenseError = (res: Response, error: unknown) => {
  console.error("[expenseController] error:", error);

  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu đầu vào không hợp lệ.", zh: "输入数据无效。" },
      400,
      error.flatten(),
    );
  }

  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  if (apiError.statusCode && apiError.messages) {
    return sendError(res, apiError.messages, apiError.statusCode);
  }

  return sendError(
    res,
    { vi: "Lỗi khi xử lý chi phí.", zh: "处理费用时出错。" },
    500,
  );
};

// ─────────────────────────────────────────────
// Handlers
// ─────────────────────────────────────────────

export const getExpenseHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId, period } = periodParamSchema.parse(req.params);

    // RBAC: Consolidated view requires special permission
    if (warehouseId === "ALL") {
      if (!hasPermission(req, "expenses.consolidated.view")) {
        return sendError(
          res,
          {
            vi: "Bạn không có quyền xem tổng hợp chi phí.",
            zh: "您没有查看综合费用的权限。",
          },
          403,
        );
      }
    } else {
      if (!hasPermission(req, "expenses.read", warehouseId)) {
        return sendError(
          res,
          {
            vi: "Bạn không có quyền xem chi phí kho này.",
            zh: "您没有查看此仓库费用的权限。",
          },
          403,
        );
      }
    }

    const data = await getExpenseData(warehouseId, period, getRequestUserId(req));
    return sendSuccess(res, data, {
      vi: "Lấy dữ liệu chi phí thành công.",
      zh: "成功获取费用数据。",
    });
  } catch (error) {
    return handleExpenseError(res, error);
  }
};

export const updateItemHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId, period, category } = categoryParamSchema.parse(req.params);
    const itemData = updateItemBodySchema.parse(req.body);

    // RBAC: Check category-specific write permission
    const requiredPerm = getRequiredPermission(category);
    if (!hasPermission(req, requiredPerm, warehouseId)) {
      return sendError(
        res,
        {
          vi: `Bạn không có quyền nhập liệu nhóm chi phí này.`,
          zh: `您没有录入此费用组的权限。`,
        },
        403,
      );
    }

    const data = await updateExpenseItem(
      warehouseId,
      period,
      category,
      itemData,
      getRequestUserId(req),
    );

    return sendSuccess(res, data, {
      vi: "Cập nhật chi phí thành công.",
      zh: "成功更新费用。",
    });
  } catch (error) {
    return handleExpenseError(res, error);
  }
};

export const closePeriodHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId, period } = periodParamSchema.parse(req.params);

    // RBAC: Check close_period permission
    if (!hasPermission(req, "expenses.close_period", warehouseId)) {
      return sendError(
        res,
        {
          vi: "Bạn không có quyền chốt kỳ kế toán.",
          zh: "您没有结账权限。",
        },
        403,
      );
    }

    const data = await closePeriod(warehouseId, period, getRequestUserId(req));
    return sendSuccess(res, data, {
      vi: "Chốt kỳ kế toán thành công.",
      zh: "成功结账。",
    });
  } catch (error) {
    return handleExpenseError(res, error);
  }
};

export const getDashboardHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId, period } = periodParamSchema.parse(req.params);

    // RBAC: Same read permissions as getExpenseHandler
    if (warehouseId === "ALL") {
      if (!hasPermission(req, "expenses.consolidated.view")) {
        return sendError(
          res,
          {
            vi: "Bạn không có quyền xem tổng hợp chi phí.",
            zh: "您没有查看综合费用的权限。",
          },
          403,
        );
      }
    } else {
      if (!hasPermission(req, "expenses.read", warehouseId)) {
        return sendError(
          res,
          {
            vi: "Bạn không có quyền xem chi phí kho này.",
            zh: "您没有查看此仓库费用的权限。",
          },
          403,
        );
      }
    }

    const data = await getDashboardMetrics(warehouseId, period);
    return sendSuccess(res, data, {
      vi: "Lấy dữ liệu dashboard thành công.",
      zh: "成功获取仪表盘数据。",
    });
  } catch (error) {
    return handleExpenseError(res, error);
  }
};
