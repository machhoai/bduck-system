import type { Request, Response } from "express";
import { z } from "zod";

import { posWarehouseParamsSchema } from "../../services/posDeviceSchemas.js";
import {
  posProductCatalogSyncSchema,
  posProductVisibilitySettingsSchema,
} from "../../services/posProductVisibilitySchemas.js";
import {
  getPosProductVisibilitySettings,
  savePosProductVisibilitySettings,
  syncPosProductCatalog,
} from "../../services/posProductVisibilityService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

import { requireRequestPosDevice } from "./posCustomerDisplayControllerSupport.js";

const handleError = (response: Response, error: unknown) => {
  console.error("[posProductVisibilityController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      response,
      {
        vi: "Cấu hình hiển thị sản phẩm không hợp lệ.",
        zh: "商品显示配置无效。",
      },
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
      vi: "Không thể xử lý cấu hình hiển thị sản phẩm.",
      zh: "无法处理商品显示配置。",
    },
    500,
  );
};

export const getPosProductVisibilitySettingsHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    const result = await getPosProductVisibilitySettings(
      warehouseId,
      requireRequestAuthorization(request),
    );
    return sendSuccess(response, result);
  } catch (error) {
    return handleError(response, error);
  }
};

export const savePosProductVisibilitySettingsHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    const actor = requireAuthenticatedRequestUser(request);
    const value = posProductVisibilitySettingsSchema.parse(request.body);
    const result = await savePosProductVisibilitySettings({
      warehouseId,
      actorId: actor.id,
      value,
      authorization: requireRequestAuthorization(request),
      auditMetadata: getAuditRequestMetadata(request),
      source: "JPULSE",
    });
    return sendSuccess(response, result, {
      vi: "Đã cập nhật sản phẩm hiển thị trên JPOS.",
      zh: "已更新 JPOS 显示商品。",
    });
  } catch (error) {
    return handleError(response, error);
  }
};

export const syncPosProductCatalogHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    const actor = requireAuthenticatedRequestUser(request);
    const value = posProductCatalogSyncSchema.parse(request.body);
    const result = await syncPosProductCatalog({
      warehouseId,
      actorId: actor.id,
      value,
      authorization: requireRequestAuthorization(request),
    });
    return sendSuccess(response, result, {
      vi: "Đã đồng bộ danh mục sản phẩm từ JPOS.",
      zh: "已从 JPOS 同步商品目录。",
    });
  } catch (error) {
    return handleError(response, error);
  }
};

export const getPosProductVisibilitySettingsFromDeviceHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const device = await requireRequestPosDevice(request);
    const result = await getPosProductVisibilitySettings(
      device.warehouse_id,
      requireRequestAuthorization(request),
    );
    return sendSuccess(response, result);
  } catch (error) {
    return handleError(response, error);
  }
};

export const savePosProductVisibilitySettingsFromDeviceHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const device = await requireRequestPosDevice(request);
    const actor = requireAuthenticatedRequestUser(request);
    const value = posProductVisibilitySettingsSchema.parse(request.body);
    const result = await savePosProductVisibilitySettings({
      warehouseId: device.warehouse_id,
      actorId: actor.id,
      value,
      authorization: requireRequestAuthorization(request),
      auditMetadata: {
        ...getAuditRequestMetadata(request),
        device_id: device.id,
      },
      source: "JPOS",
    });
    return sendSuccess(response, result, {
      vi: "Đã cập nhật sản phẩm hiển thị.",
      zh: "已更新显示商品。",
    });
  } catch (error) {
    return handleError(response, error);
  }
};
