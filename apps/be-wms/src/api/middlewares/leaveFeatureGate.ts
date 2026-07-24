import { resolveLeaveFeatureEnabled } from "@bduck/shared-types";
import type { RequestHandler } from "express";
import { sendError } from "../../utils/responseHelper.js";

export const requireLeaveFeatureEnabled: RequestHandler = (_req, res, next) => {
  try {
    if (
      resolveLeaveFeatureEnabled(
        process.env.LEAVE_FEATURE_ENABLED,
        process.env.NODE_ENV,
      )
    ) {
      next();
      return;
    }
    sendError(
      res,
      {
        vi: "Chức năng nghỉ phép chưa được mở chính thức.",
        zh: "休假功能尚未正式启用。",
      },
      503,
    );
  } catch (error) {
    console.error("[leaveFeatureGate] invalid rollout configuration", error);
    sendError(
      res,
      {
        vi: "Cấu hình triển khai chức năng nghỉ phép không hợp lệ.",
        zh: "休假功能部署配置无效。",
      },
      503,
    );
  }
};
