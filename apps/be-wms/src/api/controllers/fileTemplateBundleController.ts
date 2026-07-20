import type { Request, Response } from "express";
import { z } from "zod";
import {
  createFileTemplateBundle,
  deleteFileTemplateBundle,
  fetchFileTemplateBundles,
  updateFileTemplateBundle,
} from "../../services/fileTemplateBundleService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

const fields = {
  name: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1000).nullable().optional(),
  template_ids: z.array(z.string().uuid()).min(1).max(50),
  process_document_ids: z.array(z.string().uuid()).max(50),
};
const createSchema = z.object({
  ...fields,
  process_document_ids: fields.process_document_ids.default([]),
});
const updateSchema = z
  .object({
    name: fields.name.optional(),
    description: fields.description,
    template_ids: fields.template_ids.optional(),
    process_document_ids: fields.process_document_ids.optional(),
  })
  .refine((value) => Object.keys(value).length > 0);
const idSchema = z.object({ id: z.string().uuid() });
const userId = (req: Request) => (req as any).user?.id || "unknown";

function handleError(res: Response, error: unknown) {
  console.error("[fileTemplateBundleController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu bộ biểu mẫu không hợp lệ.", zh: "模板包数据无效。" },
      400,
      error.flatten(),
    );
  }
  const known = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  return known.statusCode && known.messages
    ? sendError(res, known.messages, known.statusCode)
    : sendError(
        res,
        { vi: "Không thể xử lý bộ biểu mẫu.", zh: "无法处理模板包。" },
        500,
      );
}

export async function getFileTemplateBundlesHandler(
  _req: Request,
  res: Response,
) {
  try {
    return sendSuccess(res, await fetchFileTemplateBundles());
  } catch (error) {
    return handleError(res, error);
  }
}

export async function createFileTemplateBundleHandler(
  req: Request,
  res: Response,
) {
  try {
    const bundle = await createFileTemplateBundle(
      createSchema.parse(req.body),
      userId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(
      res,
      bundle,
      { vi: "Đã tạo bộ biểu mẫu.", zh: "模板包已创建。" },
      201,
    );
  } catch (error) {
    return handleError(res, error);
  }
}

export async function updateFileTemplateBundleHandler(
  req: Request,
  res: Response,
) {
  try {
    const { id } = idSchema.parse(req.params);
    const bundle = await updateFileTemplateBundle(
      id,
      updateSchema.parse(req.body),
      userId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, bundle, {
      vi: "Đã cập nhật bộ biểu mẫu.",
      zh: "模板包已更新。",
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function deleteFileTemplateBundleHandler(
  req: Request,
  res: Response,
) {
  try {
    const { id } = idSchema.parse(req.params);
    await deleteFileTemplateBundle(
      id,
      userId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "Đã xóa bộ biểu mẫu.",
      zh: "模板包已删除。",
    });
  } catch (error) {
    return handleError(res, error);
  }
}
