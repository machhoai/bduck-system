import type { Request, Response } from "express";
import { z } from "zod";
import {
  customerInvoiceRequestParamsSchema,
  customerInvoiceRequestSubmissionSchema,
  customerInvoiceTaxParamsSchema,
} from "../../services/customerInvoiceRequestSchemas.js";
import {
  assertCustomerInvoiceRequestAcceptsInput,
  getCustomerInvoiceRequest,
  submitCustomerInvoiceRequest,
} from "../../services/customerInvoiceRequestService.js";
import { lookupVietQrTaxCode } from "../../services/vietQrTaxLookupService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

const handleError = (res: Response, error: unknown) => {
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Thông tin yêu cầu hóa đơn không hợp lệ.",
        zh: "发票申请信息无效。",
      },
      400,
      { code: "INVALID_INVOICE_REQUEST", fields: error.flatten() },
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
  const code = error instanceof Error ? error.message : "UNKNOWN_PUBLIC_ERROR";
  console.error("[customerInvoiceRequestController]", { code });
  return sendError(
    res,
    {
      vi: "Không thể xử lý yêu cầu hóa đơn lúc này.",
      zh: "当前无法处理发票申请。",
    },
    500,
    { code },
  );
};

export const getCustomerInvoiceRequestHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { token } = customerInvoiceRequestParamsSchema.parse(req.params);
    const data = await getCustomerInvoiceRequest(token);
    return sendSuccess(res, data, {
      vi: "Đã tải thông tin yêu cầu hóa đơn.",
      zh: "发票申请信息已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const lookupCustomerTaxCodeHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { token, taxCode } = customerInvoiceTaxParamsSchema.parse(req.params);
    const request = await getCustomerInvoiceRequest(token);
    assertCustomerInvoiceRequestAcceptsInput(request);
    const data = await lookupVietQrTaxCode(taxCode);
    return sendSuccess(res, [data], {
      vi: "Đã tìm thấy thông tin doanh nghiệp.",
      zh: "已找到企业信息。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const submitCustomerInvoiceRequestHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { token } = customerInvoiceRequestParamsSchema.parse(req.params);
    const submission = customerInvoiceRequestSubmissionSchema.parse(req.body);
    const deviceHeader = req.header("x-device-id")?.trim() ?? "";
    const data = await submitCustomerInvoiceRequest({
      token,
      submission,
      ipAddress: req.ip || null,
      deviceId:
        deviceHeader && deviceHeader.length <= 120 ? deviceHeader : null,
    });
    return sendSuccess(res, data, {
      vi: data.duplicate
        ? "Yêu cầu hóa đơn đã được tiếp nhận trước đó."
        : "Đã tiếp nhận thông tin xuất hóa đơn.",
      zh: data.duplicate
        ? "发票申请此前已被接收。"
        : "开票信息已接收。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
