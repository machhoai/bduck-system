import { AuditAction, type ApprovalLevel } from "@bduck/shared-types";
import type { Request, Response } from "express";
import { z } from "zod";
import { logAudit } from "../../services/auditService.js";
import * as processConfigService from "../../services/processConfigService.js";
import * as scannableProductService from "../../services/externalQueueScannableProductService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const CONFIG_ENTITY = "EXTERNAL_QUEUE_EXPORT" as const;
const facilityLocationSchema = z.object({
  warehouse_id: z.string().uuid(),
  warehouse_location_id: z.string().uuid(),
});
const productsUpdateSchema = facilityLocationSchema.extend({
  product_ids: z.array(z.string().uuid()).default([]),
});
const approvalLevelSchema = z.object({
  level: z.number().int().min(0).max(2),
  role_id: z.string().trim().default(""),
  label: z.object({
    vi: z.string().trim().min(1),
    zh: z.string().trim().min(1),
  }),
  required: z.boolean(),
  enabled: z.boolean(),
  min_approvers: z.number().int().min(1).default(1),
  approval_scope: z
    .enum([
      "ENTITY_WAREHOUSE",
      "SOURCE_WAREHOUSE",
      "DESTINATION_WAREHOUSE",
      "GLOBAL",
    ])
    .default("ENTITY_WAREHOUSE")
    .optional(),
  allow_global_fallback: z.boolean().default(false).optional(),
});
const approvalUpdateSchema = z
  .object({
    warehouse_id: z.string().uuid(),
    auto_approve: z.boolean(),
    approval_chain: z.array(approvalLevelSchema).max(3),
  })
  .superRefine((data, context) => {
    const active = new Set(
      data.approval_chain
        .filter((level) => level.required || level.enabled)
        .map((level) => level.level),
    );
    if (active.has(2) && !active.has(1)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["approval_chain"],
        message: "Level 3 requires level 2.",
      });
    }
    data.approval_chain.forEach((level) => {
      if ((level.required || level.enabled) && !level.role_id) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["approval_chain"],
          message: `Role is required for level ${level.level + 1}.`,
        });
      }
    });
  });
const approvalQuerySchema = z.object({ warehouse_id: z.string().uuid() });

const handleError = (res: Response, error: unknown): void => {
  console.error("[externalQueueConfigController] error:", error);
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  sendError(
    res,
    apiError.messages ?? {
      vi: "Lỗi cấu hình hàng chờ.",
      zh: "扫描队列配置失败。",
    },
    error instanceof z.ZodError ? 400 : (apiError.statusCode ?? 500),
  );
};

export const getScannableProductsConfig = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = facilityLocationSchema.parse(req.query);
    requireRequestAuthorization(req).assert(
      "external_scan.manage_queue",
      input.warehouse_id,
    );
    const data = await scannableProductService.getConfigViewForLocation(
      input.warehouse_id,
      input.warehouse_location_id,
    );
    sendSuccess(res, data, {
      vi: "Đã tải cấu hình sản phẩm quét.",
      zh: "扫描产品配置已加载。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateScannableProductsConfig = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = productsUpdateSchema.parse(req.body);
    const user = requireAuthenticatedRequestUser(req);
    requireRequestAuthorization(req).assert(
      "external_scan.manage_queue",
      input.warehouse_id,
    );
    const data = await scannableProductService.upsertConfigForLocation({
      warehouseId: input.warehouse_id,
      locationId: input.warehouse_location_id,
      productIds: input.product_ids,
      updatedBy: user.id,
    });
    sendSuccess(res, data, {
      vi: "Đã lưu cấu hình sản phẩm quét.",
      zh: "扫描产品配置已保存。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const getApprovalConfig = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const { warehouse_id } = approvalQuerySchema.parse(req.query);
    requireRequestAuthorization(req).assert(
      "external_scan.manage_queue",
      warehouse_id,
    );
    const data = await processConfigService.getConfigForEntity(
      CONFIG_ENTITY,
      warehouse_id,
    );
    sendSuccess(res, data, {
      vi: "Đã tải cấu hình cấp duyệt.",
      zh: "审批配置已加载。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateApprovalConfig = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = approvalUpdateSchema.parse(req.body);
    const user = requireAuthenticatedRequestUser(req);
    requireRequestAuthorization(req).assert(
      "external_scan.manage_queue",
      input.warehouse_id,
    );
    const existing = await processConfigService.getConfigForEntity(
      CONFIG_ENTITY,
      input.warehouse_id,
    );
    const target = existing.id.startsWith("default_")
      ? await processConfigService.seedConfigIfMissing(
          CONFIG_ENTITY,
          input.warehouse_id,
        )
      : existing;
    const approvalChain: ApprovalLevel[] = input.approval_chain
      .filter((level) => level.level === 0 || level.required || level.enabled)
      .map((level) => ({
        ...level,
        approval_scope: level.approval_scope ?? "ENTITY_WAREHOUSE",
        allow_global_fallback: level.allow_global_fallback === true,
      }))
      .sort((left, right) => left.level - right.level);
    const updated = await processConfigService.updateConfig(target.id, {
      approval_chain: approvalChain,
      auto_approve: input.auto_approve,
      require_evidence: target.require_evidence ?? false,
      require_otp: target.require_otp ?? false,
      step_options: target.step_options ?? {},
    });
    await logAudit({
      entity_type: "PROCESS_CONFIG",
      entity_id: updated.id,
      warehouse_id: input.warehouse_id,
      action: AuditAction.UPDATE,
      user_id: user.id,
      old_value: existing as unknown as Record<string, unknown>,
      new_value: updated as unknown as Record<string, unknown>,
      notes: "External queue approval configuration updated",
    });
    sendSuccess(res, updated, {
      vi: "Đã lưu cấu hình cấp duyệt.",
      zh: "审批配置已保存。",
    });
  } catch (error) {
    handleError(res, error);
  }
};
