import type { Request, Response } from "express";
import { z } from "zod";

import { posWarehouseParamsSchema } from "../../services/posDeviceSchemas.js";
import { posLuckyDrawSettingsSchema } from "../../services/posLuckyDrawSettingsSchemas.js";
import {
  getPosLuckyDrawSettings,
  savePosLuckyDrawSettings,
} from "../../services/posLuckyDrawSettingsService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const handleError = (response: Response, error: unknown) => {
  console.error("[posLuckyDrawSettingsController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      response,
      { vi: "Cấu hình phiếu bốc thăm không hợp lệ.", zh: "抽奖券配置无效。" },
      400,
      error.flatten(),
    );
  }
  const domain = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  if (domain.statusCode && domain.messages) {
    return sendError(response, domain.messages, domain.statusCode);
  }
  return sendError(
    response,
    {
      vi: "Không thể xử lý cấu hình phiếu bốc thăm.",
      zh: "无法处理抽奖券配置。",
    },
    500,
  );
};

export const getPosLuckyDrawSettingsHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    return sendSuccess(
      response,
      await getPosLuckyDrawSettings(
        warehouseId,
        requireRequestAuthorization(request),
      ),
    );
  } catch (error) {
    return handleError(response, error);
  }
};

export const savePosLuckyDrawSettingsHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    const value = posLuckyDrawSettingsSchema.parse(request.body);
    const actor = requireAuthenticatedRequestUser(request);
    const settings = await savePosLuckyDrawSettings({
      warehouseId,
      actorId: actor.id,
      value,
      authorization: requireRequestAuthorization(request),
      auditMetadata: getAuditRequestMetadata(request),
    });
    return sendSuccess(response, settings, {
      vi: "Đã cập nhật cấu hình phiếu bốc thăm.",
      zh: "抽奖券配置已更新。",
    });
  } catch (error) {
    return handleError(response, error);
  }
};
