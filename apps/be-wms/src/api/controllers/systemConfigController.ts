import type { Request, Response } from "express";
import { z } from "zod";
import {
  getOpenApiConfig,
  listOpenApiConfigs,
  updateOpenApiConfigSchema,
  upsertOpenApiConfig,
} from "../../services/openApiConfigService.js";
import { testOpenApiConnection } from "../../services/openApiService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

const warehouseParamSchema = z.object({
  warehouseId: z.string().trim().min(1),
});

const getActorId = (req: Request) => {
  const user = (req as Request & { user?: { id?: string; uid?: string } }).user;
  return user?.id || user?.uid || "system";
};

export const listOpenApiConfigsHandler = async (_req: Request, res: Response) => {
  try {
    const configs = await listOpenApiConfigs();
    return sendSuccess(res, configs, {
      vi: "Da tai cau hinh OpenAPI.",
      zh: "OpenAPI 配置已加载。",
    });
  } catch (error) {
    console.error("[systemConfigController] listOpenApiConfigs:", error);
    return sendError(res, {
      vi: "Khong the tai cau hinh OpenAPI.",
      zh: "无法加载 OpenAPI 配置。",
    }, 500);
  }
};

export const getOpenApiConfigHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseParamSchema.parse(req.params);
    const config = await getOpenApiConfig(warehouseId);
    return sendSuccess(res, config, {
      vi: config ? "Da tai cau hinh OpenAPI." : "Kho nay chua co cau hinh OpenAPI.",
      zh: config ? "OpenAPI 配置已加载。" : "该仓库尚未配置 OpenAPI。",
    });
  } catch (error) {
    console.error("[systemConfigController] getOpenApiConfig:", error);
    return sendError(res, {
      vi: "Khong the tai cau hinh OpenAPI.",
      zh: "无法加载 OpenAPI 配置。",
    }, 400);
  }
};

export const upsertOpenApiConfigHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseParamSchema.parse(req.params);
    const parsed = updateOpenApiConfigSchema.parse(req.body);
    const config = await upsertOpenApiConfig(warehouseId, parsed, getActorId(req));
    return sendSuccess(res, config, {
      vi: "Da luu cau hinh OpenAPI.",
      zh: "OpenAPI 配置已保存。",
    });
  } catch (error) {
    console.error("[systemConfigController] upsertOpenApiConfig:", error);
    const isValidation = error instanceof z.ZodError;
    return sendError(res, {
      vi: isValidation
        ? "Du lieu cau hinh OpenAPI khong hop le."
        : error instanceof Error
          ? error.message
          : "Khong the luu cau hinh OpenAPI.",
      zh: isValidation ? "OpenAPI 配置数据无效。" : "无法保存 OpenAPI 配置。",
    }, isValidation ? 400 : 500);
  }
};

export const testOpenApiConfigHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseParamSchema.parse(req.params);
    const response = await testOpenApiConnection(warehouseId);
    return sendSuccess(res, response, {
      vi: "Ket noi OpenAPI thanh cong.",
      zh: "OpenAPI 连接成功。",
    });
  } catch (error) {
    console.error("[systemConfigController] testOpenApiConfig:", error);
    return sendError(res, {
      vi: error instanceof Error ? error.message : "Khong the ket noi OpenAPI.",
      zh: "无法连接 OpenAPI。",
    }, 400);
  }
};
