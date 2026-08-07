import type { Request, Response } from "express";
import { z } from "zod";

import {
  getInvoiceBulkDisplayConfig,
  saveInvoiceBulkDisplayConfig,
} from "../../services/invoiceBulkDisplayConfigService.js";
import {
  createInvoiceBulkIssueSchema,
  invoiceBulkDisplayConfigQuerySchema,
  previewInvoiceBulkIssueSchema,
  saveInvoiceBulkDisplayConfigSchema,
} from "../../services/invoiceBulkIssueSchemas.js";
import {
  createInvoiceBulkIssue,
  previewInvoiceBulkIssue,
} from "../../services/invoiceBulkIssueService.js";
import {
  createInvoiceIssueJobSchema,
  invoiceIssueItemParamsSchema,
  invoiceIssueJobParamsSchema,
  invoiceIssueJobScopeSchema,
  listInvoiceIssueRetryCandidatesSchema,
  retryInvoiceIssueItemsSchema,
} from "../../services/invoiceIssueSchemas.js";
import {
  createInvoiceIssueJob,
  getInvoiceIssueJob,
  listInvoiceIssueRetryCandidates,
  processInvoiceIssueItem,
  retryRejectedInvoiceIssueItems,
  sweepInvoiceIssueItems,
} from "../../services/invoiceIssueService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  hasNonEmptySecret,
  securelyMatchesSecret,
} from "../../utils/secureSecret.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const handleError = (res: Response, error: unknown) => {
  console.error("[invoiceIssueController]", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Yêu cầu phát hành không hợp lệ.", zh: "开票请求无效。" },
      400,
      error.flatten(),
    );
  }
  const known = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
    data?: unknown;
    message?: string;
  };
  if (known.statusCode && known.messages) {
    return sendError(res, known.messages, known.statusCode, known.data);
  }
  return sendError(
    res,
    { vi: "Không thể xử lý job phát hành hóa đơn.", zh: "无法处理开票任务。" },
    500,
    { code: known.message ?? "UNKNOWN_INVOICE_ISSUE_ERROR" },
  );
};

const assertWorker = (req: Request, res: Response) => {
  const secret = process.env.MEINVOICE_WORKER_SECRET;
  if (!hasNonEmptySecret(secret)) {
    sendError(
      res,
      { vi: "Chưa cấu hình worker secret.", zh: "尚未配置工作器密钥。" },
      503,
    );
    return false;
  }
  if (!securelyMatchesSecret(req.header("x-meinvoice-worker-secret"), secret)) {
    sendError(
      res,
      { vi: "Worker không được xác thực.", zh: "工作器身份验证失败。" },
      401,
    );
    return false;
  }
  return true;
};

export const createInvoiceIssueJobHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = createInvoiceIssueJobSchema.parse(req.body);
    const data = await createInvoiceIssueJob(
      input,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tạo job phát hành hóa đơn.",
      zh: "开票任务已创建。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const previewInvoiceBulkIssueHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = previewInvoiceBulkIssueSchema.parse(req.body);
    const user = requireAuthenticatedRequestUser(req);
    const data = await previewInvoiceBulkIssue(
      input,
      user.id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tính tổng đợt xuất hóa đơn.",
      zh: "已计算批量开票汇总。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getInvoiceBulkDisplayConfigHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = invoiceBulkDisplayConfigQuerySchema.parse(req.query);
    const data = await getInvoiceBulkDisplayConfig(
      input.warehouse_id,
      input.business_date,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải cấu hình tên sản phẩm và đơn vị.",
      zh: "已加载商品名称和单位配置。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const saveInvoiceBulkDisplayConfigHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = saveInvoiceBulkDisplayConfigSchema.parse(req.body);
    const data = await saveInvoiceBulkDisplayConfig(
      input.warehouse_id,
      input.business_date,
      {
        item_name_mapping: input.item_name_mapping,
        ...(input.item_unit_mapping
          ? { item_unit_mapping: input.item_unit_mapping }
          : {}),
        ...(input.unit_name_mapping
          ? { unit_name_mapping: input.unit_name_mapping }
          : {}),
        action_time: input.action_time,
      },
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã lưu cấu hình tên sản phẩm và đơn vị.",
      zh: "已保存商品名称和单位配置。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const createInvoiceBulkIssueHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = createInvoiceBulkIssueSchema.parse(req.body);
    const user = requireAuthenticatedRequestUser(req);
    const data = await createInvoiceBulkIssue(
      input,
      user.id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã đưa hóa đơn vào hàng đợi phát hành.",
      zh: "发票已加入开具队列。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getInvoiceIssueJobHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { jobId } = invoiceIssueJobParamsSchema.parse(req.params);
    const { warehouse_id } = invoiceIssueJobScopeSchema.parse(req.query);
    const data = await getInvoiceIssueJob(
      jobId,
      warehouse_id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải tiến độ phát hành.",
      zh: "已加载开票进度。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listInvoiceIssueRetryCandidatesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = listInvoiceIssueRetryCandidatesSchema.parse(req.query);
    const data = await listInvoiceIssueRetryCandidates(
      input,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải các hóa đơn bị MISA từ chối có thể thử lại.",
      zh: "已加载可安全重试的 MISA 拒绝发票。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const retryRejectedInvoiceIssueItemsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = retryInvoiceIssueItemsSchema.parse(req.body);
    const data = await retryRejectedInvoiceIssueItems(
      input,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã kiểm tra RefID và đưa các hóa đơn bị từ chối vào hàng đợi thử lại.",
      zh: "已检查 RefID，并将被拒发票重新加入队列。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const processInvoiceIssueItemHandler = async (
  req: Request,
  res: Response,
) => {
  if (!assertWorker(req, res)) return;
  try {
    const { jobId, itemId } = invoiceIssueItemParamsSchema.parse(req.params);
    const data = await processInvoiceIssueItem(jobId, itemId);
    if (data.processed === false && data.reason === "NOT_DUE") {
      return sendError(
        res,
        {
          vi: "Task đến trước thời điểm xử lý; Cloud Tasks sẽ giao lại.",
          zh: "任务提前到达，Cloud Tasks 将重新投递。",
        },
        409,
        { retry_at: data.retry_at },
      );
    }
    if (data.processed === false && data.reason === "LANE_BUSY") {
      return sendError(
        res,
        {
          vi: "Lane đang bận; Cloud Tasks sẽ thử lại.",
          zh: "队列通道繁忙，将重试。",
        },
        409,
      );
    }
    return sendSuccess(res, data, {
      vi: "Đã xử lý item phát hành.",
      zh: "开票项目已处理。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const sweepInvoiceIssueItemsHandler = async (
  req: Request,
  res: Response,
) => {
  if (!assertWorker(req, res)) return;
  try {
    const data = await sweepInvoiceIssueItems();
    return sendSuccess(res, data, {
      vi: "Đã quét phục hồi job phát hành.",
      zh: "已扫描恢复开票任务。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
