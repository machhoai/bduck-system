import type { Request, Response } from "express";
import { z } from "zod";

import { posWarehouseParamsSchema } from "../../services/posDeviceSchemas.js";
import { getPosPaymentSettings, posPaymentSettingsSchema, savePosPaymentSettings } from "../../services/posPaymentSettingsService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { requireAuthenticatedRequestUser, requireRequestAuthorization } from "../middlewares/requestAccessContext.js";

const handleError = (response: Response, error: unknown) => {
  console.error("[posPaymentSettingsController] error:", error);
  if (error instanceof z.ZodError) return sendError(response, { vi: "Cấu hình chuyển khoản không hợp lệ.", zh: "转账配置无效。" }, 400, error.flatten());
  const domain = error as { statusCode?: number; messages?: { vi: string; zh: string } };
  if (domain.statusCode && domain.messages) return sendError(response, domain.messages, domain.statusCode);
  return sendError(response, { vi: "Không thể xử lý cấu hình thanh toán POS.", zh: "无法处理 POS 支付配置。" }, 500);
};

export const getPosPaymentSettingsHandler = async (request: Request, response: Response) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    return sendSuccess(response, await getPosPaymentSettings(warehouseId, requireRequestAuthorization(request)));
  } catch (error) { return handleError(response, error); }
};

export const savePosPaymentSettingsHandler = async (request: Request, response: Response) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    const value = posPaymentSettingsSchema.parse(request.body);
    const actor = requireAuthenticatedRequestUser(request);
    return sendSuccess(response, await savePosPaymentSettings({ warehouseId, actorId: actor.id, value, authorization: requireRequestAuthorization(request), auditMetadata: getAuditRequestMetadata(request) }), { vi: "Đã cập nhật cấu hình thanh toán POS.", zh: "POS 支付配置已更新。" });
  } catch (error) { return handleError(response, error); }
};
