import type { Request, Response } from "express";
import { z } from "zod";
import {
  fetchNotificationDispatches,
  sendEmailNotification,
  sendManualInAppNotification,
} from "../../services/notificationService.js";
import {
  registerPushToken,
  unregisterPushToken,
} from "../../services/pushNotificationService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  notificationDispatchQuerySchema,
  notificationPushTokenSchema,
  sendEmailNotificationSchema,
  sendInAppNotificationSchema,
} from "../../utils/zodSchemas.js";

const getRequestUserId = (req: Request) => (req as any).user?.id || "unknown";

const handleNotificationError = (res: Response, error: unknown) => {
  console.error("[notificationController] error:", error);

  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu thông báo không hợp lệ.",
        zh: "通知数据无效。",
      },
      400,
      error.flatten(),
    );
  }

  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };

  if (apiError.statusCode && apiError.messages) {
    return sendError(res, apiError.messages, apiError.statusCode);
  }

  return sendError(
    res,
    {
      vi: "Lỗi khi xử lý thông báo.",
      zh: "处理通知时出错。",
    },
    500,
  );
};

export const getNotificationDispatchesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { limit } = notificationDispatchQuerySchema.parse(req.query);
    const dispatches = await fetchNotificationDispatches(limit);

    return sendSuccess(res, dispatches, {
      vi: "Lấy lịch sử thông báo thành công.",
      zh: "成功获取通知历史。",
    });
  } catch (error) {
    return handleNotificationError(res, error);
  }
};

export const sendInAppNotificationHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const payload = sendInAppNotificationSchema.parse(req.body);
    const dispatch = await sendManualInAppNotification(
      payload,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(
      res,
      dispatch,
      {
        vi: "Đã gửi thông báo in-app.",
        zh: "应用内通知已发送。",
      },
      201,
    );
  } catch (error) {
    return handleNotificationError(res, error);
  }
};

export const sendEmailNotificationHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const payload = sendEmailNotificationSchema.parse(req.body);
    const dispatch = await sendEmailNotification(
      payload,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(
      res,
      dispatch,
      {
        vi: "Đã gửi email.",
        zh: "邮件已发送。",
      },
      201,
    );
  } catch (error) {
    return handleNotificationError(res, error);
  }
};

export const registerPushTokenHandler = async (req: Request, res: Response) => {
  try {
    const payload = notificationPushTokenSchema.parse(req.body);
    const pushToken = await registerPushToken({
      userId: getRequestUserId(req),
      token: payload.token,
      platform: payload.platform,
      userAgent: payload.user_agent,
    });

    return sendSuccess(
      res,
      { id: pushToken.id, enabled: true },
      {
        vi: "Da bat thong bao tren thiet bi.",
        zh: "已启用设备通知。",
      },
      201,
    );
  } catch (error) {
    return handleNotificationError(res, error);
  }
};

export const unregisterPushTokenHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const payload = notificationPushTokenSchema
      .pick({ token: true })
      .parse(req.body);
    await unregisterPushToken({
      userId: getRequestUserId(req),
      token: payload.token,
    });

    return sendSuccess(res, { enabled: false }, {
      vi: "Da tat thong bao tren thiet bi.",
      zh: "已关闭设备通知。",
    });
  } catch (error) {
    return handleNotificationError(res, error);
  }
};
