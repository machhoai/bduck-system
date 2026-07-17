import type { Request, Response } from "express";
import { z } from "zod";
import {
  createProcessDocument,
  deleteProcessDocument,
  fetchProcessDocuments,
} from "../../services/processDocumentService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

const createSchema = z.object({
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(1000).nullable().optional(),
  file_name: z
    .string()
    .trim()
    .min(1)
    .max(240)
    .refine((name) => /\.pdf$/i.test(name)),
  file_url: z.string().url(),
  file_size: z
    .number()
    .int()
    .min(1)
    .max(20 * 1024 * 1024),
  file_format: z.literal("pdf"),
});
const idSchema = z.object({ id: z.string().uuid() });
const userId = (req: Request) => (req as any).user?.id || "unknown";

function handleError(res: Response, error: unknown) {
  console.error("[processDocumentController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Tài liệu quy trình phải là tệp PDF hợp lệ.",
        zh: "流程文档必须是有效的 PDF 文件。",
      },
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
        { vi: "Không thể xử lý tài liệu quy trình.", zh: "无法处理流程文档。" },
        500,
      );
}

export async function getProcessDocumentsHandler(_req: Request, res: Response) {
  try {
    return sendSuccess(res, await fetchProcessDocuments());
  } catch (error) {
    return handleError(res, error);
  }
}

export async function createProcessDocumentHandler(
  req: Request,
  res: Response,
) {
  try {
    const document = await createProcessDocument(
      createSchema.parse(req.body),
      userId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(
      res,
      document,
      { vi: "Đã tải lên tài liệu quy trình.", zh: "流程文档已上传。" },
      201,
    );
  } catch (error) {
    return handleError(res, error);
  }
}

export async function deleteProcessDocumentHandler(
  req: Request,
  res: Response,
) {
  try {
    const { id } = idSchema.parse(req.params);
    await deleteProcessDocument(id, userId(req), getAuditRequestMetadata(req));
    return sendSuccess(res, null, {
      vi: "Đã xóa tài liệu quy trình.",
      zh: "流程文档已删除。",
    });
  } catch (error) {
    return handleError(res, error);
  }
}
