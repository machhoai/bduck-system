import type { Request, Response } from "express";
import { z } from "zod";

import {
  activatePosDeviceSchema,
  changePosDeviceStatusSchema,
  createPosEnrollmentSchema,
  openPosDeviceSessionSchema,
  posDeviceParamsSchema,
  posWarehouseParamsSchema,
} from "../../services/posDeviceSchemas.js";
import {
  activatePosDevice,
  changePosDeviceStatus,
  createPosEnrollment,
  getPosStoreOverview,
  listPosDevices,
  openPosDeviceSession,
  PosDeviceError,
} from "../../services/posDeviceService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const handleError = (res: Response, error: unknown) => {
  console.error("[posDeviceController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu quản lý POS không hợp lệ.", zh: "POS 管理数据无效。" },
      400,
      error.flatten(),
    );
  }
  if (error instanceof PosDeviceError) {
    return sendError(res, error.messages, error.statusCode);
  }
  const domainError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  if (domainError.statusCode && domainError.messages) {
    return sendError(res, domainError.messages, domainError.statusCode);
  }
  return sendError(
    res,
    { vi: "Không thể xử lý yêu cầu quản lý POS.", zh: "无法处理 POS 管理请求。" },
    500,
  );
};

export const listPosDevicesHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(req.params);
    const devices = await listPosDevices(
      warehouseId,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, devices, {
      vi: "Đã tải danh sách máy POS.",
      zh: "POS 设备列表已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getPosStoreOverviewHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(req.params);
    const overview = await getPosStoreOverview(
      warehouseId,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, overview, {
      vi: "Đã tải tổng quan POS của cửa hàng.",
      zh: "门店 POS 概览已加载。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const createPosEnrollmentHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(req.params);
    const { otp } = createPosEnrollmentSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const grant = await createPosEnrollment({
      warehouseId,
      otp,
      actorId: actor.id,
      authorization: requireRequestAuthorization(req),
      auditMetadata: getAuditRequestMetadata(req),
    });
    return sendSuccess(
      res,
      grant,
      {
        vi: "Đã tạo mã kích hoạt máy POS dùng một lần.",
        zh: "已创建一次性 POS 设备激活码。",
      },
      201,
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const activatePosDeviceHandler = async (req: Request, res: Response) => {
  try {
    const input = activatePosDeviceSchema.parse(req.body);
    const result = await activatePosDevice({
      pairingCode: input.pairing_code,
      deviceId: input.device_id,
      deviceCredential: input.device_credential,
      deviceName: input.device_name,
      fingerprint: input.fingerprint,
      appVersion: input.app_version,
      operatingSystem: input.operating_system,
    });
    return sendSuccess(
      res,
      result,
      {
        vi: "Máy POS đã được kích hoạt thành công.",
        zh: "POS 设备已成功激活。",
      },
      201,
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const openPosDeviceSessionHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const input = openPosDeviceSessionSchema.parse(req.body);
    const result = await openPosDeviceSession({
      deviceId: input.device_id,
      credential: input.device_credential,
      appVersion: input.app_version,
    });
    return sendSuccess(res, result, {
      vi: "Phiên thiết bị POS hợp lệ.",
      zh: "POS 设备会话有效。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const changePosDeviceStatusHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { deviceId } = posDeviceParamsSchema.parse(req.params);
    const { status } = changePosDeviceStatusSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const device = await changePosDeviceStatus({
      deviceId,
      status,
      actorId: actor.id,
      authorization: requireRequestAuthorization(req),
      auditMetadata: getAuditRequestMetadata(req),
    });
    return sendSuccess(res, device, {
      vi: status === "ACTIVE" ? "Đã mở khóa máy POS." : "Đã khóa máy POS.",
      zh: status === "ACTIVE" ? "POS 设备已解锁。" : "POS 设备已锁定。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
