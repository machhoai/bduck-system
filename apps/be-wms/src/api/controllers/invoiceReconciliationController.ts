import type { Request, Response } from "express";
import { z } from "zod";
import {
  invoiceDownloadSchema,
  invoiceLedgerItemSchema,
  invoiceLedgerQuerySchema,
  reconciliationCaseParamsSchema,
  resolveReconciliationCaseSchema,
  statusSweepSchema,
} from "../../services/invoiceReconciliationSchemas.js";
import {
  downloadPublishedInvoice,
  listInvoiceLedger,
  listInvoiceReconciliationCases,
  resolveInvoiceReconciliationCase,
  sweepIssuedInvoiceStatuses,
  viewPublishedInvoice,
} from "../../services/invoiceReconciliationService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { hasNonEmptySecret, securelyMatchesSecret } from "../../utils/secureSecret.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const handleError = (res: Response, error: unknown) => {
  console.error("[invoiceReconciliationController]", error);
  if (error instanceof z.ZodError) {
    return sendError(res, { vi: "Yêu cầu đối chiếu hóa đơn không hợp lệ.", zh: "发票核对请求无效。" }, 400, error.flatten());
  }
  const known = error as { statusCode?: number; messages?: { vi: string; zh: string }; data?: unknown; message?: string };
  if (known.statusCode && known.messages) return sendError(res, known.messages, known.statusCode, known.data);
  return sendError(res, { vi: "Không thể xử lý dữ liệu đối chiếu hóa đơn.", zh: "无法处理发票核对数据。" }, 502, {
    code: known.message ?? "UNKNOWN_RECONCILIATION_ERROR",
  });
};

export const listInvoiceLedgerHandler = async (req: Request, res: Response) => {
  try {
    const input = invoiceLedgerQuerySchema.parse(req.query);
    return sendSuccess(res, await listInvoiceLedger(input.warehouse_id, input.business_date, requireRequestAuthorization(req)), {
      vi: "Đã tải sổ hóa đơn.", zh: "已加载发票台账。",
    });
  } catch (error) { return handleError(res, error); }
};

export const listInvoiceReconciliationCasesHandler = async (req: Request, res: Response) => {
  try {
    const input = invoiceLedgerQuerySchema.parse(req.query);
    return sendSuccess(res, await listInvoiceReconciliationCases(input.warehouse_id, input.business_date, requireRequestAuthorization(req)), {
      vi: "Đã tải các case đối chiếu.", zh: "已加载核对事项。",
    });
  } catch (error) { return handleError(res, error); }
};

export const resolveInvoiceReconciliationCaseHandler = async (req: Request, res: Response) => {
  try {
    const { id } = reconciliationCaseParamsSchema.parse(req.params);
    const input = resolveReconciliationCaseSchema.parse(req.body);
    const data = await resolveInvoiceReconciliationCase(
      id, input.warehouse_id, input.note,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, { vi: "Đã đóng case đối chiếu.", zh: "核对事项已关闭。" });
  } catch (error) { return handleError(res, error); }
};

export const viewPublishedInvoiceHandler = async (req: Request, res: Response) => {
  try {
    const input = invoiceLedgerItemSchema.parse({ id: req.params.id, warehouse_id: req.query.warehouse_id });
    return sendSuccess(res, await viewPublishedInvoice(input.id, input.warehouse_id, requireRequestAuthorization(req)), {
      vi: "Đã tạo liên kết xem hóa đơn.", zh: "已创建发票查看链接。",
    });
  } catch (error) { return handleError(res, error); }
};

export const downloadPublishedInvoiceHandler = async (req: Request, res: Response) => {
  try {
    const input = invoiceDownloadSchema.parse({ id: req.params.id, warehouse_id: req.query.warehouse_id, type: req.query.type });
    return sendSuccess(res, await downloadPublishedInvoice(input.id, input.warehouse_id, input.type, requireRequestAuthorization(req)), {
      vi: "Đã chuẩn bị tệp hóa đơn.", zh: "发票文件已准备。",
    });
  } catch (error) { return handleError(res, error); }
};

export const sweepIssuedInvoiceStatusesHandler = async (req: Request, res: Response) => {
  const secret = process.env.MEINVOICE_WORKER_SECRET;
  if (!hasNonEmptySecret(secret)) return sendError(res, { vi: "Chưa cấu hình worker secret.", zh: "尚未配置工作密钥。" }, 503);
  if (!securelyMatchesSecret(req.header("x-meinvoice-worker-secret"), secret)) {
    return sendError(res, { vi: "Worker không được xác thực.", zh: "工作进程身份验证失败。" }, 401);
  }
  try {
    const { limit } = statusSweepSchema.parse(req.body ?? {});
    return sendSuccess(res, await sweepIssuedInvoiceStatuses(limit), { vi: "Đã đối chiếu trạng thái hóa đơn.", zh: "发票状态已核对。" });
  } catch (error) { return handleError(res, error); }
};
