import type { Request, Response } from "express";
import { z } from "zod";
import {
  createFileTemplate,
  fetchFileTemplates,
} from "../../services/fileTemplateService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

const fileTemplateSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1000).nullable().optional(),
  file_name: z.string().trim().min(1).max(240),
  file_url: z.string().url(),
  file_size: z.number().int().min(1).max(20 * 1024 * 1024),
  file_format: z.enum(["pdf", "docx", "xlsx", "csv"]),
});

const getRequestUserId = (req: Request) => (req as any).user?.id || "unknown";

const handleFileTemplateError = (res: Response, error: unknown) => {
  console.error("[fileTemplateController] error:", error);

  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu biểu mẫu không hợp lệ.",
        zh: "表单模板数据无效。",
      },
      400,
      error.flatten(),
    );
  }

  return sendError(
    res,
    {
      vi: "Lỗi khi xử lý biểu mẫu.",
      zh: "处理表单模板时出错。",
    },
    500,
  );
};

export const getFileTemplatesHandler = async (_req: Request, res: Response) => {
  try {
    const templates = await fetchFileTemplates();
    return sendSuccess(res, templates, {
      vi: "Lấy danh sách biểu mẫu thành công.",
      zh: "成功获取表单模板列表。",
    });
  } catch (error) {
    return handleFileTemplateError(res, error);
  }
};

export const createFileTemplateHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = fileTemplateSchema.parse(req.body);
    const template = await createFileTemplate(
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(
      res,
      template,
      {
        vi: "Upload biểu mẫu thành công.",
        zh: "表单模板上传成功。",
      },
      201,
    );
  } catch (error) {
    return handleFileTemplateError(res, error);
  }
};
