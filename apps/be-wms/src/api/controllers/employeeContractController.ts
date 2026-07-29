import type { Request, Response } from "express";
import { z } from "zod";

import type { EmployeeContractAuditMetadata } from "../../repositories/employeeContractRepository.js";
import {
  cancelEmployeeContract,
  createEmployeeContract,
  listEmployeeContracts,
  renewEmployeeContract,
  terminateEmployeeContract,
  updateEmployeeContract,
} from "../../services/employeeContractService.js";
import {
  cancelEmployeeContractSchema,
  createEmployeeContractSchema,
  employeeContractParamsSchema,
  employeeContractProfileParamsSchema,
  renewEmployeeContractSchema,
  terminateEmployeeContractSchema,
  updateEmployeeContractSchema,
} from "../../services/employeeContractSchemas.js";
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

const handleEmployeeContractError = (res: Response, error: unknown) => {
  console.error("[employeeContractController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu hợp đồng lao động không hợp lệ.",
        zh: "劳动合同数据无效。",
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
      vi: "Không thể xử lý hợp đồng lao động.",
      zh: "无法处理劳动合同。",
    },
    apiError.statusCode ?? 500,
    apiError.data ?? (apiError.code ? { code: apiError.code } : null),
  );
};

export const listEmployeeContractsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = employeeContractProfileParamsSchema.parse(req.params);
    const actor = requireAuthenticatedRequestUser(req);
    const data = await listEmployeeContracts(
      id,
      actor.id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải lịch sử hợp đồng lao động.",
      zh: "劳动合同历史已加载。",
    });
  } catch (error) {
    return handleEmployeeContractError(res, error);
  }
};

export const createEmployeeContractHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = employeeContractProfileParamsSchema.parse(req.params);
    const input = createEmployeeContractSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const data = await createEmployeeContract(
      id,
      input,
      actor.id,
      requireRequestAuthorization(req),
      auditMetadataFor(req),
    );
    return sendSuccess(
      res,
      data,
      {
        vi: "Đã tạo hợp đồng lao động.",
        zh: "劳动合同已创建。",
      },
      201,
    );
  } catch (error) {
    return handleEmployeeContractError(res, error);
  }
};

export const updateEmployeeContractHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id, contractId } = employeeContractParamsSchema.parse(req.params);
    const input = updateEmployeeContractSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const data = await updateEmployeeContract(
      id,
      contractId,
      input,
      actor.id,
      requireRequestAuthorization(req),
      auditMetadataFor(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã cập nhật hợp đồng lao động.",
      zh: "劳动合同已更新。",
    });
  } catch (error) {
    return handleEmployeeContractError(res, error);
  }
};

export const renewEmployeeContractHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id, contractId } = employeeContractParamsSchema.parse(req.params);
    const input = renewEmployeeContractSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const data = await renewEmployeeContract(
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
        vi: "Đã tạo hợp đồng gia hạn.",
        zh: "续签合同已创建。",
      },
      201,
    );
  } catch (error) {
    return handleEmployeeContractError(res, error);
  }
};

export const cancelEmployeeContractHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id, contractId } = employeeContractParamsSchema.parse(req.params);
    const input = cancelEmployeeContractSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const data = await cancelEmployeeContract(
      id,
      contractId,
      input,
      actor.id,
      requireRequestAuthorization(req),
      auditMetadataFor(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã hủy hợp đồng chưa có hiệu lực.",
      zh: "尚未生效的合同已取消。",
    });
  } catch (error) {
    return handleEmployeeContractError(res, error);
  }
};

export const terminateEmployeeContractHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id, contractId } = employeeContractParamsSchema.parse(req.params);
    const input = terminateEmployeeContractSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const data = await terminateEmployeeContract(
      id,
      contractId,
      input,
      actor.id,
      requireRequestAuthorization(req),
      auditMetadataFor(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã chấm dứt hợp đồng trước hạn.",
      zh: "合同已提前终止。",
    });
  } catch (error) {
    return handleEmployeeContractError(res, error);
  }
};
