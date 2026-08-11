import type { Request, Response } from "express";

import {
  posCustomerDisplayMediaParamsSchema,
  posCustomerDisplayMutationSchema,
  posCustomerDisplaySettingsInputSchema,
  posCustomerDisplayUploadHeadersSchema,
} from "../../services/posCustomerDisplaySchemas.js";
import {
  getPosCustomerDisplaySettings,
  getPosCustomerDisplayMediaContent,
  savePosCustomerDisplaySettings,
  softDeletePosCustomerDisplayMedia,
  uploadPosCustomerDisplayMedia,
} from "../../services/posCustomerDisplayService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

import {
  decodeUploadFileName,
  handlePosCustomerDisplayError,
  requireRawUploadBody,
  requireRequestPosDevice,
} from "./posCustomerDisplayControllerSupport.js";

export const getPosCustomerDisplayMediaContentFromDeviceHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const device = await requireRequestPosDevice(request);
    const { mediaId } = posCustomerDisplayMediaParamsSchema.parse(request.params);
    const content = await getPosCustomerDisplayMediaContent(device.warehouse_id, mediaId);
    response.setHeader("Content-Type", content.contentType);
    response.setHeader("Content-Length", String(content.buffer.length));
    response.setHeader("Cache-Control", "private, max-age=3600");
    return response.status(200).send(content.buffer);
  } catch (error) {
    return handlePosCustomerDisplayError(response, error);
  }
};

export const getPosCustomerDisplaySettingsFromDeviceHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const device = await requireRequestPosDevice(request);
    const result = await getPosCustomerDisplaySettings(
      device.warehouse_id,
      requireRequestAuthorization(request),
    );
    return sendSuccess(response, result);
  } catch (error) {
    return handlePosCustomerDisplayError(response, error);
  }
};

export const savePosCustomerDisplaySettingsFromDeviceHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const device = await requireRequestPosDevice(request);
    const actor = requireAuthenticatedRequestUser(request);
    const value = posCustomerDisplaySettingsInputSchema.parse(request.body);
    const result = await savePosCustomerDisplaySettings({
      warehouseId: device.warehouse_id,
      actorId: actor.id,
      value,
      authorization: requireRequestAuthorization(request),
      auditMetadata: { ...getAuditRequestMetadata(request), device_id: device.id },
      source: "JPOS",
    });
    return sendSuccess(response, result, {
      vi: "Đã đồng bộ playlist quảng cáo từ JPOS.",
      zh: "广告播放列表已从 JPOS 同步。",
    });
  } catch (error) {
    return handlePosCustomerDisplayError(response, error);
  }
};

export const uploadPosCustomerDisplayMediaFromDeviceHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const device = await requireRequestPosDevice(request);
    const actor = requireAuthenticatedRequestUser(request);
    const headers = posCustomerDisplayUploadHeadersSchema.parse(request.headers);
    const result = await uploadPosCustomerDisplayMedia({
      warehouseId: device.warehouse_id,
      actorId: actor.id,
      expectedVersion: headers["x-expected-version"],
      actionTime: headers["x-action-time"],
      fileName: decodeUploadFileName(headers["x-file-name"]),
      buffer: requireRawUploadBody(request),
      authorization: requireRequestAuthorization(request),
      auditMetadata: { ...getAuditRequestMetadata(request), device_id: device.id },
      source: "JPOS",
    });
    return sendSuccess(response, result, {
      vi: "Đã tải tệp quảng cáo từ JPOS lên.",
      zh: "广告文件已从 JPOS 上传。",
    }, 201);
  } catch (error) {
    return handlePosCustomerDisplayError(response, error);
  }
};

export const deletePosCustomerDisplayMediaFromDeviceHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const device = await requireRequestPosDevice(request);
    const actor = requireAuthenticatedRequestUser(request);
    const { mediaId } = posCustomerDisplayMediaParamsSchema.parse(request.params);
    const value = posCustomerDisplayMutationSchema.parse(request.body);
    const result = await softDeletePosCustomerDisplayMedia({
      warehouseId: device.warehouse_id,
      mediaId,
      actorId: actor.id,
      expectedVersion: value.expected_version,
      actionTime: value.action_time,
      authorization: requireRequestAuthorization(request),
      auditMetadata: { ...getAuditRequestMetadata(request), device_id: device.id },
      source: "JPOS",
    });
    return sendSuccess(response, result, {
      vi: "Đã xóa tệp khỏi playlist quảng cáo.",
      zh: "广告文件已从播放列表移除。",
    });
  } catch (error) {
    return handlePosCustomerDisplayError(response, error);
  }
};
