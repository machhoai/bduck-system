import type { Request, Response } from "express";
import { z } from "zod";
import {
  invoiceDocumentParamsSchema,
  invoiceDocumentPrepareSchema,
  invoiceDocumentPreviewSchema,
  invoiceDocumentScopeSchema,
  invoiceDocumentUpdateSchema,
} from "../../services/invoiceDocumentSchemas.js";
import {
  getInvoiceDocument,
  prepareInvoiceDocumentFromSourceOrder,
  updateInvoiceDocument,
} from "../../services/invoiceDocumentService.js";
import { previewInvoiceDocument } from "../../services/invoicePreviewService.js";
import { MeInvoiceApiError } from "../../services/meInvoiceClient.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const handleError = (res: Response, error: unknown) => {
  console.error("[invoiceDocumentController]", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu bản nháp hóa đơn không hợp lệ.",
        zh: "发票草稿数据无效。",
      },
      400,
      error.flatten(),
    );
  }
  if (error instanceof MeInvoiceApiError) {
    return sendError(
      res,
      {
        vi: "Không thể tạo bản xem trước từ MISA meInvoice.",
        zh: "无法从 MISA meInvoice 创建预览。",
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
  const code =
    error instanceof Error ? error.message : "UNKNOWN_INVOICE_DOCUMENT_ERROR";
  return sendError(
    res,
    { vi: "Không thể xử lý bản nháp hóa đơn.", zh: "无法处理发票草稿。" },
    500,
    { code },
  );
};

export const prepareInvoiceDocumentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = invoiceDocumentParamsSchema.parse(req.params);
    const input = invoiceDocumentPrepareSchema.parse(req.body);
    const data = await prepareInvoiceDocumentFromSourceOrder(
      id,
      input.warehouse_id,
      input.expected_source_payload_hash,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã chuẩn bị bản nháp hóa đơn.",
      zh: "发票草稿已准备完成。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getInvoiceDocumentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = invoiceDocumentParamsSchema.parse(req.params);
    const input = invoiceDocumentScopeSchema.parse(req.query);
    const data = await getInvoiceDocument(
      id,
      input.warehouse_id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải bản nháp hóa đơn.",
      zh: "发票草稿已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateInvoiceDocumentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = invoiceDocumentParamsSchema.parse(req.params);
    const input = invoiceDocumentUpdateSchema.parse(req.body);
    const data = await updateInvoiceDocument(
      id,
      input,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã lưu revision bản nháp hóa đơn.",
      zh: "发票草稿修订已保存。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const previewInvoiceDocumentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = invoiceDocumentParamsSchema.parse(req.params);
    const input = invoiceDocumentPreviewSchema.parse(req.body);
    const data = await previewInvoiceDocument(
      id,
      input.warehouse_id,
      input.expected_revision,
      input.expected_source_payload_hash,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tạo link xem trước trong 5 phút.",
      zh: "已创建 5 分钟有效的预览链接。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
