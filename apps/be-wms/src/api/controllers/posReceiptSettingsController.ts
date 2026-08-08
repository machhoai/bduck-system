import type { Request, Response } from "express";
import { z } from "zod";

import { posWarehouseParamsSchema } from "../../services/posDeviceSchemas.js";
import { posReceiptSettingsSchema } from "../../services/posReceiptSettingsSchemas.js";
import { getPosReceiptSettings, savePosReceiptSettings } from "../../services/posReceiptSettingsService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { requireAuthenticatedRequestUser, requireRequestAuthorization } from "../middlewares/requestAccessContext.js";

const handleError = (response: Response, error: unknown) => {
  console.error("[posReceiptSettingsController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(response, { vi: "Cấu hình hóa đơn không hợp lệ.", zh: "小票配置无效。" }, 400, error.flatten());
  }
  const domain = error as { statusCode?: number; messages?: { vi: string; zh: string } };
  if (domain.statusCode && domain.messages) return sendError(response, domain.messages, domain.statusCode);
  return sendError(response, { vi: "Không thể xử lý cấu hình hóa đơn POS.", zh: "无法处理 POS 小票配置。" }, 500);
};

export const getPosReceiptSettingsHandler = async (request: Request, response: Response) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    return sendSuccess(response, await getPosReceiptSettings(warehouseId, requireRequestAuthorization(request)));
  } catch (error) { return handleError(response, error); }
};

export const savePosReceiptSettingsHandler = async (request: Request, response: Response) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    const value = posReceiptSettingsSchema.parse(request.body);
    const actor = requireAuthenticatedRequestUser(request);
    const settings = await savePosReceiptSettings({ warehouseId, actorId: actor.id, value, authorization: requireRequestAuthorization(request), auditMetadata: getAuditRequestMetadata(request) });
    return sendSuccess(response, settings, { vi: "Đã cập nhật cấu hình hóa đơn POS.", zh: "POS 小票配置已更新。" });
  } catch (error) { return handleError(response, error); }
};
