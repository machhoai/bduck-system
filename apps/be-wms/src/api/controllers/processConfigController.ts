/**
 * Process Config Controller — Admin endpoints for managing pipeline configs
 *
 * GET    /                  — List all configs
 * GET    /:entityType       — Get config for entity type
 * PUT    /:id               — Update config (approval chain, step options)
 * POST   /seed/:entityType  — Seed default config if missing
 *
 * ARCHITECTURE: Controller → Service → Repository (layered)
 */

import type { Request, Response, NextFunction } from "express";
import * as configService from "../../services/processConfigService.js";
import { updateConfigSchema } from "../../services/processConfigService.js";
import type { ProcessEntityType } from "@bduck/shared-types";

/**
 * GET /api/process-configs
 * List all process configs (admin view).
 */
export async function getAllConfigsHandler(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const configs = await configService.getAllConfigs();

    res.json({
      success: true,
      data: configs,
      messages: {
        vi: `Tìm thấy ${configs.length} cấu hình quy trình.`,
        zh: `找到 ${configs.length} 个流程配置。`,
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/process-configs/:entityType
 * Get config for a specific entity type (with warehouse fallback).
 */
export async function getConfigHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const entityType = req.params.entityType as ProcessEntityType;
    const warehouseId = req.query.warehouse_id as string | undefined;

    const config = await configService.getConfigForEntity(
      entityType,
      warehouseId,
    );

    res.json({
      success: true,
      data: config,
      messages: {
        vi: "Đã tải cấu hình quy trình.",
        zh: "已加载流程配置。",
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/process-configs/:id
 * Update config (approval chain, step options).
 */
export async function updateConfigHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const configId = req.params.id as string;

    // Validate input (Zod — LUẬT THÉP)
    const parseResult = updateConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        data: null,
        messages: {
          vi:
            "Dữ liệu không hợp lệ: " +
            parseResult.error.issues
              .map((i: { message: string }) => i.message)
              .join(", "),
          zh:
            "数据无效: " +
            parseResult.error.issues
              .map((i: { message: string }) => i.message)
              .join(", "),
        },
        errors: parseResult.error.issues,
      });
      return;
    }

    const updated = await configService.updateConfig(
      configId,
      parseResult.data,
    );

    res.json({
      success: true,
      data: updated,
      messages: {
        vi: "Đã cập nhật cấu hình quy trình.",
        zh: "已更新流程配置。",
      },
    });
  } catch (error: any) {
    if (error.statusCode) {
      res.status(error.statusCode).json({
        success: false,
        data: null,
        messages: error.messages || { vi: error.message, zh: error.message },
      });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/process-configs/seed/:entityType
 * Seed default config if missing.
 */
export async function seedConfigHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const entityType = req.params.entityType as ProcessEntityType;
    const config = await configService.seedConfigIfMissing(entityType);

    res.json({
      success: true,
      data: config,
      messages: {
        vi: "Đã tạo/tải cấu hình mặc định.",
        zh: "已创建/加载默认配置。",
      },
    });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/process-configs/reseed/:entityType
 * Force re-seed: deletes old config and creates fresh one with resolved role IDs.
 * Fixes bad configs that have hardcoded role names instead of Firestore doc IDs.
 */
export async function reseedConfigHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const entityType = req.params.entityType as ProcessEntityType;
    const config = await configService.reseedConfig(entityType);

    res.json({
      success: true,
      data: config,
      messages: {
        vi: "Đã tạo lại cấu hình quy trình với role ID chính xác.",
        zh: "已使用正确的角色 ID 重新创建流程配置。",
      },
    });
  } catch (error) {
    next(error);
  }
}

