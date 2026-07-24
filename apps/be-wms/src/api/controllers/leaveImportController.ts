import type { Request, Response } from "express";
import { z } from "zod";
import {
  commitLeaveHistoryImport,
  fetchLeaveImportBatches,
  fetchLeaveImportBatchView,
} from "../../services/leaveImportService.js";
import { previewLeaveHistoryImport } from "../../services/leaveImportPreviewService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const safeFileName = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[^/\\<>:"|?*\u0000-\u001F]+\.xlsx$/iu);

const previewSchema = z
  .object({
    source_file_name: safeFileName,
    source_file_url: z.string().url().max(2048),
    source_file_checksum: z.string().regex(/^[a-f0-9]{64}$/iu),
    action_time: z.coerce.date(),
  })
  .strict();

const commitSchema = z
  .object({
    action_time: z.coerce.date(),
  })
  .strict();

const batchIdSchema = z.string().uuid();

const handleError = (res: Response, error: unknown) => {
  console.error("[leaveImportController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Thông tin nhập lịch sử nghỉ phép không hợp lệ.",
        zh: "历史休假导入信息无效。",
      },
      400,
      error.flatten(),
    );
  }
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  return sendError(
    res,
    apiError.messages ?? {
      vi: "Không thể xử lý dữ liệu lịch sử nghỉ phép.",
      zh: "无法处理历史休假数据。",
    },
    apiError.statusCode ?? 500,
  );
};

export const previewLeaveImportHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    return sendSuccess(
      res,
      await previewLeaveHistoryImport(
        previewSchema.parse(req.body),
        actor.id,
        requireRequestAuthorization(req),
      ),
      {
        vi: "Đã kiểm tra và tạo bản xem trước.",
        zh: "已校验并生成预览。",
      },
      201,
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const listLeaveImportsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    return sendSuccess(
      res,
      await fetchLeaveImportBatches(
        actor.id,
        requireRequestAuthorization(req),
      ),
      { vi: "Đã tải lịch sử nhập dữ liệu.", zh: "导入历史已加载。" },
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const getLeaveImportHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    return sendSuccess(
      res,
      await fetchLeaveImportBatchView(
        batchIdSchema.parse(req.params.id),
        actor.id,
        requireRequestAuthorization(req),
      ),
      { vi: "Đã tải chi tiết bản nhập.", zh: "导入详情已加载。" },
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const commitLeaveImportHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    return sendSuccess(
      res,
      await commitLeaveHistoryImport(
        batchIdSchema.parse(req.params.id),
        commitSchema.parse(req.body),
        actor.id,
        requireRequestAuthorization(req),
      ),
      {
        vi: "Đã ghi nhận lịch sử nghỉ phép.",
        zh: "历史休假数据已提交。",
      },
    );
  } catch (error) {
    return handleError(res, error);
  }
};
