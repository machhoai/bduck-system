import type { Request, Response } from "express";
import { z } from "zod";
import {
  completeReceiving,
  completeReceivingSchema,
  createExportFromTransfer,
  createTransferOrder,
  createTransferOrderSchema,
  receiveTransfer,
  updateTransferOrder,
  updateTransferOrderSchema,
} from "../../services/transferOrderService.js";
import {
  getTransferOrderById,
  listTransferOrders,
} from "../../services/transferQueryService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const orderIdSchema = z.string().uuid();
const listFiltersSchema = z.object({
  source_warehouse_id: z.string().uuid().optional(),
  destination_warehouse_id: z.string().uuid().optional(),
  transfer_type: z.string().trim().max(80).optional(),
  status: z.string().trim().max(80).optional(),
});
const createExportSchema = z.object({
  additional_attachment_urls: z.array(z.string().url()).max(10).default([]),
});

const handleError = (res: Response, error: unknown): void => {
  console.error("[transferOrderController] error:", error);
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
      vi: "Lỗi khi xử lý phiếu điều chuyển.",
      zh: "处理调拨单时出错。",
    },
    apiError.statusCode ?? 500,
  );
};

export const createHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const order = await createTransferOrder(
      createTransferOrderSchema.parse(req.body),
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
    );
    sendSuccess(
      res,
      order,
      { vi: "Đã tạo phiếu điều chuyển.", zh: "调拨单创建成功。" },
      201,
    );
  } catch (error) {
    handleError(res, error);
  }
};

export const updateHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const order = await updateTransferOrder(
      orderIdSchema.parse(req.params.id),
      updateTransferOrderSchema.parse(req.body),
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
    );
    sendSuccess(res, order, {
      vi: "Đã cập nhật phiếu điều chuyển.",
      zh: "调拨单更新成功。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const listHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const orders = await listTransferOrders(
      listFiltersSchema.parse(req.query),
      requireRequestAuthorization(req),
    );
    sendSuccess(res, orders, {
      vi: "Lấy danh sách phiếu điều chuyển thành công.",
      zh: "成功获取调拨单列表。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getDetailHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const detail = await getTransferOrderById(
      orderIdSchema.parse(req.params.id),
      requireRequestAuthorization(req),
    );
    sendSuccess(res, detail, {
      vi: "Lấy chi tiết phiếu điều chuyển thành công.",
      zh: "成功获取调拨单详情。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const createExportHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = createExportSchema.parse(req.body);
    const voucher = await createExportFromTransfer(
      orderIdSchema.parse(req.params.id),
      requireAuthenticatedRequestUser(req).id,
      input.additional_attachment_urls,
      requireRequestAuthorization(req),
    );
    sendSuccess(
      res,
      voucher,
      {
        vi: "Đã tạo lệnh xuất từ phiếu điều chuyển.",
        zh: "已从调拨单创建出库单。",
      },
      201,
    );
  } catch (error) {
    handleError(res, error);
  }
};

export const receiveHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await receiveTransfer(
      orderIdSchema.parse(req.params.id),
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
    );
    sendSuccess(res, null, {
      vi: "Đã bắt đầu nhận hàng.",
      zh: "已开始收货。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const completeReceivingHandler = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    await completeReceiving(
      orderIdSchema.parse(req.params.id),
      completeReceivingSchema.parse(req.body),
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
    );
    sendSuccess(res, null, {
      vi: "Đã hoàn tất nhận hàng.",
      zh: "收货已完成。",
    });
  } catch (error) {
    handleError(res, error);
  }
};
