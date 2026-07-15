import type { Request, Response } from "express";
import { z } from "zod";
import {
  fetchImportVoucherById,
  fetchImportVouchers,
  fetchImportVoucherTimeline,
} from "../../services/importVoucherQueryService.js";
import {
  createImportVoucher,
  createImportVoucherSchema,
  updateImportVoucher,
  updateImportVoucherSchema,
} from "../../services/importVoucherService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const listFiltersSchema = z.object({
  status: z.string().trim().max(80).optional(),
  creator_id: z.string().trim().max(128).optional(),
  approver_id: z.string().trim().max(128).optional(),
  warehouse_id: z.string().uuid().optional(),
  voucher_number: z.string().trim().max(120).optional(),
  date_from: z.string().date().optional(),
  date_to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().uuid().optional(),
});

const handleError = (res: Response, error: unknown): void => {
  console.error("[importVoucherController] error:", error);
  if (error instanceof z.ZodError) {
    sendError(
      res,
      { vi: "Dữ liệu đầu vào không hợp lệ.", zh: "输入数据无效。" },
      400,
      error.flatten(),
    );
    return;
  }
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  sendError(
    res,
    apiError.messages ?? {
      vi: "Lỗi khi xử lý phiếu nhập kho.",
      zh: "处理入库单时出错。",
    },
    apiError.statusCode ?? 500,
  );
};

export const getImportVouchersHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const vouchers = await fetchImportVouchers(
      listFiltersSchema.parse(req.query),
      requireRequestAuthorization(req),
    );
    sendSuccess(res, vouchers, {
      vi: "Lấy danh sách phiếu nhập kho thành công.",
      zh: "成功获取入库单列表。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getImportVoucherByIdHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const detail = await fetchImportVoucherById(
      z.string().uuid().parse(req.params.id),
      requireRequestAuthorization(req),
    );
    sendSuccess(res, detail, {
      vi: "Lấy chi tiết phiếu nhập kho thành công.",
      zh: "成功获取入库单详情。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getImportVoucherTimelineHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const timeline = await fetchImportVoucherTimeline(
      z.string().uuid().parse(req.params.id),
      requireRequestAuthorization(req),
    );
    sendSuccess(res, timeline, {
      vi: "Lấy lịch sử xử lý phiếu nhập thành công.",
      zh: "成功获取入库单处理历史。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const createImportVoucherHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const voucher = await createImportVoucher(
      createImportVoucherSchema.parse(req.body),
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
    );
    sendSuccess(
      res,
      voucher,
      {
        vi: "Phiếu nhập kho đã được tạo thành công.",
        zh: "入库单已成功创建。",
      },
      201,
    );
  } catch (error) {
    handleError(res, error);
  }
};

export const updateImportVoucherHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const voucher = await updateImportVoucher(
      z.string().uuid().parse(req.params.id),
      updateImportVoucherSchema.parse(req.body),
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
    );
    sendSuccess(res, voucher, {
      vi: "Phiếu nhập kho đã được cập nhật thành công.",
      zh: "入库单已成功更新。",
    });
  } catch (error) {
    handleError(res, error);
  }
};
