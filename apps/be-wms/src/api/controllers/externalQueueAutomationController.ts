import type { Request, Response } from "express";
import { z } from "zod";
import * as autoSubmitConfigService from "../../services/externalQueueAutoSubmitConfigService.js";
import * as externalScanService from "../../services/externalScanService.js";
import * as scopedQueueService from "../../services/scopedExternalQueueService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  hasNonEmptySecret,
  securelyMatchesSecret,
} from "../../utils/secureSecret.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const autoSubmitSchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  warehouse_location_id: z.string().uuid().optional(),
  older_than_minutes: z.number().int().min(1).max(1440).optional(),
});

const handleError = (res: Response, error: unknown): void => {
  console.error("[externalQueueAutomationController] error:", error);
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  sendError(
    res,
    apiError.messages ?? {
      vi: "Lỗi tự động gửi hàng chờ.",
      zh: "自动提交扫描队列失败。",
    },
    error instanceof z.ZodError ? 400 : (apiError.statusCode ?? 500),
  );
};

export const getAutoSubmitSchedule = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!requireRequestAuthorization(req).context.isSystemAdmin) {
      throw {
        statusCode: 403,
        messages: {
          vi: "Chỉ quản trị hệ thống được xem lịch toàn cục.",
          zh: "仅系统管理员可查看全局计划。",
        },
      };
    }
    sendSuccess(res, await autoSubmitConfigService.getAutoSubmitSchedule(), {
      vi: "Đã tải lịch auto-submit.",
      zh: "自动提交计划已加载。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const updateAutoSubmitSchedule = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    if (!requireRequestAuthorization(req).context.isSystemAdmin) {
      throw {
        statusCode: 403,
        messages: {
          vi: "Chỉ quản trị hệ thống được sửa lịch toàn cục.",
          zh: "仅系统管理员可修改全局计划。",
        },
      };
    }
    const input = autoSubmitConfigService.updateAutoSubmitScheduleSchema.parse(
      req.body,
    );
    const data = await autoSubmitConfigService.updateAutoSubmitSchedule(
      input,
      requireAuthenticatedRequestUser(req).id,
    );
    sendSuccess(res, data, {
      vi: "Đã cập nhật lịch auto-submit.",
      zh: "自动提交计划已更新。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const autoSubmitQueuedLocations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const input = autoSubmitSchema.parse(req.body ?? {});
    const authorization = requireRequestAuthorization(req);
    scopedQueueService.assertOptionalFacilityAction(
      input.warehouse_id,
      "external_scan.manage_queue",
      authorization,
    );
    const data = await externalScanService.autoSubmitQueuedLocations({
      actorId: requireAuthenticatedRequestUser(req).id,
      warehouseId: input.warehouse_id,
      warehouseLocationId: input.warehouse_location_id,
      olderThanMinutes: input.older_than_minutes,
    });
    sendSuccess(res, data, {
      vi: "Đã chạy auto-submit theo quầy.",
      zh: "已按柜台执行自动提交。",
    });
  } catch (error) {
    handleError(res, error);
  }
};

export const runScheduledAutoSubmit = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const configuredSecret = process.env.EXTERNAL_QUEUE_AUTO_SUBMIT_CRON_SECRET;
    if (!hasNonEmptySecret(configuredSecret)) {
      sendError(
        res,
        { vi: "Chưa cấu hình cron secret.", zh: "尚未配置定时任务密钥。" },
        503,
      );
      return;
    }
    if (!securelyMatchesSecret(req.header("x-cron-secret"), configuredSecret)) {
      sendError(
        res,
        { vi: "Cron secret không hợp lệ.", zh: "定时任务密钥无效。" },
        401,
      );
      return;
    }
    const headerTime = req.header("x-cloudscheduler-scheduletime");
    const parsedTime = headerTime ? new Date(headerTime) : new Date();
    const candidate = autoSubmitConfigService.getGmt7ScheduleCandidate(
      Number.isFinite(parsedTime.getTime()) ? parsedTime : new Date(),
    );
    const claimed = await autoSubmitConfigService.claimAutoSubmitScheduleRun(
      candidate.runKey,
      candidate.time,
      new Date(),
      { enforceScheduledTime: false },
    );
    if (!claimed) {
      sendSuccess(
        res,
        { skipped: true, run_key: candidate.runKey },
        {
          vi: "Đã bỏ qua cron do lịch không khớp hoặc đã chạy.",
          zh: "计划不匹配或已执行，已跳过。",
        },
      );
      return;
    }
    const result = await externalScanService.autoSubmitQueuedLocations({
      actorId: "system:cloud-scheduler:external-queue-auto-submit",
    });
    await autoSubmitConfigService.completeAutoSubmitScheduleRun(
      candidate.runKey,
      {
        submitted_batches: result.submitted_batches,
        submitted_scans: result.submitted_scans,
      },
    );
    sendSuccess(
      res,
      { ...result, run_key: candidate.runKey, scheduled_time: candidate.time },
      {
        vi: "Đã chạy cron auto-submit theo lịch.",
        zh: "已按计划执行自动提交。",
      },
    );
  } catch (error) {
    handleError(res, error);
  }
};
