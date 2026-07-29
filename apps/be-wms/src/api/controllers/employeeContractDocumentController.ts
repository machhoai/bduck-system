import type { Request, Response } from "express";
import { z } from "zod";

import type { EmployeeContractAuditMetadata } from "../../repositories/employeeContractRepository.js";
import {
  createEmployeeContractDocumentUploadIntent,
  finalizeEmployeeContractDocumentUpload,
  getEmployeeContractDocumentDownload,
  listEmployeeContractDocuments,
} from "../../services/employeeContractDocumentService.js";
import {
  createEmployeeContractUploadIntentSchema,
  employeeContractDocumentDownloadQuerySchema,
  employeeContractDocumentParamsSchema,
  employeeContractDocumentTargetParamsSchema,
  employeeContractUploadIntentParamsSchema,
  finalizeEmployeeContractUploadSchema,
} from "../../services/employeeContractDocumentSchemas.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { mapFirebaseError } from "../../utils/firebaseErrorHandler.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const auditMetadataFor = (req: Request): EmployeeContractAuditMetadata => {
  const metadata = getAuditRequestMetadata(req);
  return {
    ip_address: metadata.ip_address,
    device_id: metadata.device_id,
    session_token: metadata.session_token,
  };
};

const handleError = (res: Response, error: unknown) => {
  console.error("[employeeContractDocumentController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu tệp hợp đồng không hợp lệ.",
        zh: "合同文件数据无效。",
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
    data?: unknown;
    code?: string;
  };
  return sendError(
    res,
    apiError.messages ?? {
      vi: "Không thể xử lý tệp hợp đồng.",
      zh: "无法处理合同文件。",
    },
    apiError.statusCode ?? 500,
    apiError.data ?? (apiError.code ? { code: apiError.code } : null),
  );
};

export const createEmployeeContractDocumentUploadIntentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id, contractId } = employeeContractDocumentTargetParamsSchema.parse(
      req.params,
    );
    const input = createEmployeeContractUploadIntentSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const data = await createEmployeeContractDocumentUploadIntent(
      id,
      contractId,
      input,
      actor.id,
      requireRequestAuthorization(req),
      auditMetadataFor(req),
    );
    return sendSuccess(
      res,
      data,
      {
        vi: "Đã tạo yêu cầu tải tệp PDF hợp đồng.",
        zh: "合同 PDF 上传请求已创建。",
      },
      201,
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const finalizeEmployeeContractDocumentUploadHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id, contractId, intentId } =
      employeeContractUploadIntentParamsSchema.parse(req.params);
    const input = finalizeEmployeeContractUploadSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const data = await finalizeEmployeeContractDocumentUpload(
      id,
      contractId,
      intentId,
      input,
      actor.id,
      requireRequestAuthorization(req),
      auditMetadataFor(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã xác thực và lưu phiên bản tệp hợp đồng.",
      zh: "合同文件版本已验证并保存。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listEmployeeContractDocumentsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id, contractId } = employeeContractDocumentTargetParamsSchema.parse(
      req.params,
    );
    const actor = requireAuthenticatedRequestUser(req);
    const data = await listEmployeeContractDocuments(
      id,
      contractId,
      actor.id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải lịch sử tệp hợp đồng.",
      zh: "合同文件历史已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getEmployeeContractDocumentDownloadHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id, contractId, documentId } =
      employeeContractDocumentParamsSchema.parse(req.params);
    const { mode } = employeeContractDocumentDownloadQuerySchema.parse(
      req.query,
    );
    const actor = requireAuthenticatedRequestUser(req);
    const data = await getEmployeeContractDocumentDownload(
      id,
      contractId,
      documentId,
      actor.id,
      requireRequestAuthorization(req),
      mode,
    );
    return sendSuccess(res, data, {
      vi: "Đã tạo liên kết xem tệp hợp đồng ngắn hạn.",
      zh: "合同文件短期查看链接已创建。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
