import type { Request, Response } from "express";
import { z } from "zod";
import {
  createFileTemplate,
  deleteFileTemplate,
  fetchFileTemplates,
  updateFileTemplate,
  uploadNewVersion,
} from "../../services/fileTemplateService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

const fileFormatSchema = z.enum(["pdf", "docx", "xlsx", "csv"]);
const fileTemplateCategorySchema = z.enum([
  "finance",
  "admin",
  "delivery",
  "operations",
  "general",
]);

const fileTemplateCreateSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1000).nullable().optional(),
  category: fileTemplateCategorySchema.default("general"),
  file_name: z.string().trim().min(1).max(240),
  file_url: z.string().url(),
  file_size: z.number().int().min(1).max(20 * 1024 * 1024),
  file_format: fileFormatSchema,
});

const fileTemplateUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(180).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    category: fileTemplateCategorySchema.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required.",
  });

const fileTemplateVersionSchema = z.object({
  file_name: z.string().trim().min(1).max(240),
  file_url: z.string().url(),
  file_size: z.number().int().min(1).max(20 * 1024 * 1024),
  file_format: fileFormatSchema,
});

const idParamSchema = z.object({
  id: z.string().uuid(),
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
    const data = fileTemplateCreateSchema.parse(req.body);
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

export const updateFileTemplateHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = fileTemplateUpdateSchema.parse(req.body);
    const template = await updateFileTemplate(
      id,
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(res, template, {
      vi: "Cập nhật biểu mẫu thành công.",
      zh: "表单模板更新成功。",
    });
  } catch (error) {
    return handleFileTemplateError(res, error);
  }
};

export const deleteFileTemplateHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteFileTemplate(
      id,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(res, null, {
      vi: "Xóa biểu mẫu thành công.",
      zh: "表单模板删除成功。",
    });
  } catch (error) {
    return handleFileTemplateError(res, error);
  }
};

export const uploadNewVersionHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = fileTemplateVersionSchema.parse(req.body);
    const template = await uploadNewVersion(
      id,
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(res, template, {
      vi: "Cập nhật phiên bản biểu mẫu thành công.",
      zh: "表单模板版本更新成功。",
    });
  } catch (error) {
    return handleFileTemplateError(res, error);
  }
};
