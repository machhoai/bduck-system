import type { Request, Response } from "express";
import { z } from "zod";

import { PosCustomerDisplayMediaError } from "../../services/posCustomerDisplayMediaValidation.js";
import { posCustomerDisplayDeviceHeadersSchema } from "../../services/posCustomerDisplaySchemas.js";
import { requireActivePosDevice } from "../../services/posDeviceSessionService.js";
import { sendError } from "../../utils/responseHelper.js";

export const handlePosCustomerDisplayError = (response: Response, error: unknown) => {
  console.error("[posCustomerDisplayController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      response,
      { vi: "Dữ liệu quảng cáo màn hình khách hàng không hợp lệ.", zh: "顾客屏广告数据无效。" },
      400,
      error.flatten(),
    );
  }
  if (error instanceof PosCustomerDisplayMediaError) {
    return sendError(response, error.messages, error.statusCode);
  }
  const domain = error as { statusCode?: number; messages?: { vi: string; zh: string } };
  if (domain.statusCode && domain.messages) {
    return sendError(response, domain.messages, domain.statusCode);
  }
  return sendError(
    response,
    { vi: "Không thể xử lý cấu hình quảng cáo màn hình khách hàng.", zh: "无法处理顾客屏广告配置。" },
    500,
  );
};

export const requireRequestPosDevice = async (request: Request) => {
  const headers = posCustomerDisplayDeviceHeadersSchema.parse(request.headers);
  return requireActivePosDevice({
    deviceId: headers["x-pos-device-id"],
    credential: headers["x-pos-device-credential"],
  });
};

export const requireRawUploadBody = (request: Request): Buffer => {
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) {
    throw Object.assign(new Error("POS_CUSTOMER_DISPLAY_FILE_REQUIRED"), {
      statusCode: 400,
      messages: { vi: "Vui lòng chọn tệp quảng cáo.", zh: "请选择广告文件。" },
    });
  }
  return request.body;
};

export const decodeUploadFileName = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};
