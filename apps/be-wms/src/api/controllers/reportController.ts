import type { Request, Response } from "express";
import { z } from "zod";
import {
  createExcelReportTemplate,
  exportExcelReport,
  getReportTemplateDetail,
  listReportTemplates,
  previewExcelReport,
  readTemplateWorkbookFile,
  updateExcelReportTemplate,
} from "../../services/reportService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  createExcelReportTemplateSchema,
  exportExcelReportSchema,
  reportIdParamSchema,
  updateExcelReportTemplateSchema,
} from "../../utils/reportSchemas.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import type { RequestUserContext } from "../../services/warehouseAccess.js";

function getRequestUser(req: Request): RequestUserContext {
  return (req as any).user as RequestUserContext;
}

function handleReportError(res: Response, error: unknown) {
  console.error("[reportController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu báo cáo không hợp lệ.",
        zh: "报表数据无效。",
      },
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
    {
      vi: "Lỗi xử lý phân hệ báo cáo.",
      zh: "处理报表模块时出错。",
    },
    500,
  );
}

export async function listReportTemplatesHandler(req: Request, res: Response) {
  try {
    const data = await listReportTemplates(getRequestUser(req));
    return sendSuccess(res, data, {
      vi: "Đã tải danh sách mẫu báo cáo.",
      zh: "已加载报表模板列表。",
    });
  } catch (error) {
    return handleReportError(res, error);
  }
}

export async function getReportTemplateHandler(req: Request, res: Response) {
  try {
    const { id } = reportIdParamSchema.parse(req.params);
    const data = await getReportTemplateDetail(id, getRequestUser(req));
    return sendSuccess(res, data, {
      vi: "Đã tải mẫu báo cáo.",
      zh: "已加载报表模板。",
    });
  } catch (error) {
    return handleReportError(res, error);
  }
}

export async function downloadReportTemplateFileHandler(
  req: Request,
  res: Response,
) {
  try {
    const { id } = reportIdParamSchema.parse(req.params);
    const { fileName, buffer } = await readTemplateWorkbookFile(
      id,
      getRequestUser(req),
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    return handleReportError(res, error);
  }
}

export async function createExcelReportTemplateHandler(
  req: Request,
  res: Response,
) {
  try {
    const input = createExcelReportTemplateSchema.parse(req.body);
    const data = await createExcelReportTemplate(
      input,
      getRequestUser(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(
      res,
      data,
      {
        vi: "Đã tạo mẫu báo cáo Excel.",
        zh: "已创建 Excel 报表模板。",
      },
      201,
    );
  } catch (error) {
    return handleReportError(res, error);
  }
}

export async function updateExcelReportTemplateHandler(
  req: Request,
  res: Response,
) {
  try {
    const { id } = reportIdParamSchema.parse(req.params);
    const input = updateExcelReportTemplateSchema.parse(req.body);
    const data = await updateExcelReportTemplate(
      id,
      input,
      getRequestUser(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã lưu mẫu báo cáo Excel.",
      zh: "已保存 Excel 报表模板。",
    });
  } catch (error) {
    return handleReportError(res, error);
  }
}

export async function previewExcelReportHandler(req: Request, res: Response) {
  try {
    const { id } = reportIdParamSchema.parse(req.params);
    const input = exportExcelReportSchema.parse(req.body);
    const data = await previewExcelReport(id, input.mapping, getRequestUser(req));
    return sendSuccess(res, data, {
      vi: "Đã preview dữ liệu báo cáo.",
      zh: "已预览报表数据。",
    });
  } catch (error) {
    return handleReportError(res, error);
  }
}

export async function exportExcelReportHandler(req: Request, res: Response) {
  try {
    const { id } = reportIdParamSchema.parse(req.params);
    const input = exportExcelReportSchema.parse(req.body);
    const { record, buffer } = await exportExcelReport(
      id,
      input.mapping,
      getRequestUser(req),
      getAuditRequestMetadata(req),
    );
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${record.output_file_name || "report.xlsx"}"`,
    );
    res.send(buffer);
  } catch (error) {
    return handleReportError(res, error);
  }
}
