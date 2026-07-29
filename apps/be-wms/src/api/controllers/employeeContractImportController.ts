import type { Request, Response } from "express";
import { z } from "zod";

import {
  commitEmployeeContractImport,
} from "../../services/employeeContractImportService.js";
import {
  createEmployeeContractImportUploadSession,
} from "../../services/employeeContractImportStorageService.js";
import {
  previewEmployeeContractImport,
} from "../../services/employeeContractImportPreviewService.js";
import { getEmployeeContractImport } from "../../services/employeeContractImportQueryService.js";
import {
  commitEmployeeContractImportSchema,
  createEmployeeContractImportUploadSessionSchema,
  employeeContractImportBatchParamsSchema,
  previewEmployeeContractImportSchema,
} from "../../services/employeeContractImportSchemas.js";
import { assertCanImportEmployeeContracts } from "../../services/employeeContractImportAccessService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { mapFirebaseError } from "../../utils/firebaseErrorHandler.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const handleError = (res: Response, error: unknown) => {
  console.error("[employeeContractImportController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu import hợp đồng không hợp lệ.",
        zh: "合同导入数据无效。",
      },
      400,
      error.flatten(),
    );
  }
  const firebaseError = mapFirebaseError(error);
  if (firebaseError) {
    return sendError(res, firebaseError.messages, firebaseError.statusCode);
  }
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
    code?: string;
  };
  return sendError(
    res,
    apiError.messages ?? {
      vi: "Không thể xử lý import lịch sử hợp đồng.",
      zh: "无法处理合同历史导入。",
    },
    apiError.statusCode ?? 500,
    apiError.code ? { code: apiError.code } : null,
  );
};

export const createEmployeeContractImportUploadSessionHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = createEmployeeContractImportUploadSessionSchema.parse(
      req.body,
    );
    const actor = requireAuthenticatedRequestUser(req);
    assertCanImportEmployeeContracts(requireRequestAuthorization(req));
    const data = await createEmployeeContractImportUploadSession(
      input,
      actor.id,
    );
    return sendSuccess(
      res,
      data,
      { vi: "Đã tạo phiên tải tệp import.", zh: "已创建导入文件上传会话。" },
      201,
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const previewEmployeeContractImportHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = previewEmployeeContractImportSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const data = await previewEmployeeContractImport(
      input,
      actor.id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(
      res,
      data,
      { vi: "Đã tạo preview toàn bộ batch.", zh: "已生成整个批次的预览。" },
      201,
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const getEmployeeContractImportHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { batchId } = employeeContractImportBatchParamsSchema.parse(
      req.params,
    );
    const actor = requireAuthenticatedRequestUser(req);
    const data = await getEmployeeContractImport(
      batchId,
      actor.id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải batch import hợp đồng.",
      zh: "已加载合同导入批次。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const commitEmployeeContractImportHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { batchId } = employeeContractImportBatchParamsSchema.parse(
      req.params,
    );
    const input = commitEmployeeContractImportSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const metadata = getAuditRequestMetadata(req);
    const data = await commitEmployeeContractImport(
      batchId,
      input,
      actor.id,
      requireRequestAuthorization(req),
      metadata,
    );
    return sendSuccess(res, data, {
      vi:
        data.batch.status === "COMPLETED"
          ? "Đã commit lịch sử hợp đồng."
          : "Batch đã commit một phần; vui lòng xem lỗi theo dòng.",
      zh:
        data.batch.status === "COMPLETED"
          ? "合同历史已提交。"
          : "批次已部分提交，请查看逐行错误。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
