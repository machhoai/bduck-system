import type { Request, Response } from "express";
import { z } from "zod";

import {
  posVoucherCampaignParamsSchema,
  posVoucherCampaignSettingSchema,
} from "../../services/posVoucherSettingsSchemas.js";
import {
  getPosVoucherSettings,
  savePosVoucherSetting,
} from "../../services/posVoucherSettingsService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const handleError = (response: Response, error: unknown) => {
  console.error("[posVoucherSettingsController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      response,
      { vi: "Cấu hình voucher không hợp lệ.", zh: "优惠券设置无效。" },
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
    { vi: "Không thể xử lý cấu hình voucher.", zh: "无法处理优惠券设置。" },
    500,
  );
};

export const getPosVoucherSettingsHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const { warehouseId } = posVoucherCampaignParamsSchema
      .pick({ warehouseId: true })
      .parse(request.params);
    return sendSuccess(
      response,
      await getPosVoucherSettings(
        warehouseId,
        requireRequestAuthorization(request),
      ),
    );
  } catch (error) {
    return handleError(response, error);
  }
};

export const savePosVoucherSettingHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const params = posVoucherCampaignParamsSchema.parse(request.params);
    const actor = requireAuthenticatedRequestUser(request);
    const value = posVoucherCampaignSettingSchema.parse(request.body);
    const result = await savePosVoucherSetting({
      ...params,
      actorId: actor.id,
      value,
      authorization: requireRequestAuthorization(request),
      auditMetadata: getAuditRequestMetadata(request),
    });
    return sendSuccess(response, result, {
      vi: "Đã cập nhật cấu hình voucher cho cửa hàng.",
      zh: "已更新门店优惠券设置。",
    });
  } catch (error) {
    return handleError(response, error);
  }
};
