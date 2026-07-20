import type { Request, Response } from "express";
import { z } from "zod";
import { InvoiceOrderSyncPurpose } from "@bduck/shared-types";
import {
  invoiceOrderDetailInputSchema,
  invoiceOrderListQuerySchema,
  invoiceOrderPreviewInputSchema,
  invoiceOrderSyncInputSchema,
} from "../../services/invoiceOrderSyncSchemas.js";
import {
  getInvoiceSourceOrder,
  listInvoiceSourceOrders,
  syncInvoiceOrdersForDate,
} from "../../services/invoiceOrderSyncService.js";
import { previewInvoiceSourceOrder } from "../../services/invoicePreviewService.js";
import { MeInvoiceApiError } from "../../services/meInvoiceClient.js";
import { reconcileInvoiceDay } from "../../services/invoiceReconciliationService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const handleError = (res: Response, error: unknown) => {
  console.error("[invoiceOrderSyncController]", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Ngày hoặc phạm vi đồng bộ không hợp lệ.",
        zh: "同步日期或范围无效。",
      },
      400,
      error.flatten(),
    );
  }
  if (error instanceof MeInvoiceApiError) {
    return sendError(
      res,
      {
        vi: "Không thể xử lý yêu cầu với MISA meInvoice.",
        zh: "无法处理 MISA meInvoice 请求。",
      },
      error.httpStatus >= 400 && error.httpStatus < 500 ? 400 : 502,
      { code: error.code },
    );
  }
  const known = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
    data?: unknown;
  };
  if (known.statusCode && known.messages) {
    return sendError(res, known.messages, known.statusCode, known.data);
  }
  const code = error instanceof Error ? error.message : "UNKNOWN_SYNC_ERROR";
  return sendError(
    res,
    {
      vi: "Không thể xử lý dữ liệu hóa đơn.",
      zh: "无法处理发票数据。",
    },
    502,
    { code },
  );
};

export const previewInvoiceSourceOrderHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = invoiceOrderDetailInputSchema
      .pick({ id: true })
      .parse(req.params);
    const input = invoiceOrderPreviewInputSchema.parse(req.body);
    const result = await previewInvoiceSourceOrder(
      id,
      input.warehouse_id,
      input.expected_source_payload_hash,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, result, {
      vi: "Đã tạo liên kết xem trước hóa đơn trong 5 phút.",
      zh: "已创建有效期为 5 分钟的发票预览链接。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getInvoiceSourceOrderHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = invoiceOrderDetailInputSchema.parse({
      id: req.params.id,
      warehouse_id: req.query.warehouse_id,
    });
    const result = await getInvoiceSourceOrder(
      input.id,
      input.warehouse_id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, result, {
      vi: "Đã tải chi tiết đơn hàng.",
      zh: "已加载订单详情。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const syncInvoiceOrdersHandler = async (req: Request, res: Response) => {
  try {
    const input = invoiceOrderSyncInputSchema.parse(req.body);
    const authorization = requireRequestAuthorization(req);
    const actorId = requireAuthenticatedRequestUser(req).id;
    const auditMetadata = getAuditRequestMetadata(req);
    const result = await syncInvoiceOrdersForDate(
      input,
      actorId,
      authorization,
      auditMetadata,
    );
    const reconciliation = input.purpose === InvoiceOrderSyncPurpose.RECONCILIATION
      ? await reconcileInvoiceDay(
          input.warehouse_id,
          input.business_date,
          actorId,
          authorization,
          auditMetadata,
        )
      : null;
    return sendSuccess(res, { ...result, reconciliation }, {
      vi: "Đã đồng bộ đầy đủ dữ liệu đơn hàng trong ngày.",
      zh: "已完整同步当日订单数据。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listInvoiceSourceOrdersHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const query = invoiceOrderListQuerySchema.parse(req.query);
    const result = await listInvoiceSourceOrders(
      query.warehouse_id,
      query.business_date,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, result, {
      vi: "Đã tải dữ liệu đơn hàng đã đồng bộ.",
      zh: "已加载同步的订单数据。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
