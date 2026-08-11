import type { Request, Response } from "express";

import {
  posCustomerDisplayMediaParamsSchema,
  posCustomerDisplayMutationSchema,
  posCustomerDisplaySettingsInputSchema,
  posCustomerDisplayUploadHeadersSchema,
} from "../../services/posCustomerDisplaySchemas.js";
import {
  getPosCustomerDisplaySettings,
  savePosCustomerDisplaySettings,
  softDeletePosCustomerDisplayMedia,
  uploadPosCustomerDisplayMedia,
} from "../../services/posCustomerDisplayService.js";
import { posWarehouseParamsSchema } from "../../services/posDeviceSchemas.js";
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
} from "./posCustomerDisplayControllerSupport.js";

export const getPosCustomerDisplaySettingsHandler = async (request: Request, response: Response) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    const result = await getPosCustomerDisplaySettings(
      warehouseId,
      requireRequestAuthorization(request),
    );
    return sendSuccess(response, result);
  } catch (error) {
    return handlePosCustomerDisplayError(response, error);
  }
};

export const savePosCustomerDisplaySettingsHandler = async (request: Request, response: Response) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    const actor = requireAuthenticatedRequestUser(request);
    const value = posCustomerDisplaySettingsInputSchema.parse(request.body);
    const result = await savePosCustomerDisplaySettings({
      warehouseId,
      actorId: actor.id,
      value,
      authorization: requireRequestAuthorization(request),
      auditMetadata: getAuditRequestMetadata(request),
      source: "JPULSE",
    });
    return sendSuccess(response, result, {
      vi: "Đã cập nhật playlist quảng cáo.",
      zh: "广告播放列表已更新。",
    });
  } catch (error) {
    return handlePosCustomerDisplayError(response, error);
  }
};

export const uploadPosCustomerDisplayMediaHandler = async (request: Request, response: Response) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    const headers = posCustomerDisplayUploadHeadersSchema.parse(request.headers);
    const actor = requireAuthenticatedRequestUser(request);
    const result = await uploadPosCustomerDisplayMedia({
      warehouseId,
      actorId: actor.id,
      expectedVersion: headers["x-expected-version"],
      actionTime: headers["x-action-time"],
      fileName: decodeUploadFileName(headers["x-file-name"]),
      buffer: requireRawUploadBody(request),
      authorization: requireRequestAuthorization(request),
      auditMetadata: getAuditRequestMetadata(request),
      source: "JPULSE",
    });
    return sendSuccess(response, result, {
      vi: "Đã tải tệp quảng cáo lên.",
      zh: "广告文件已上传。",
    }, 201);
  } catch (error) {
    return handlePosCustomerDisplayError(response, error);
  }
};

export const deletePosCustomerDisplayMediaHandler = async (request: Request, response: Response) => {
  try {
    const { warehouseId } = posWarehouseParamsSchema.parse(request.params);
    const { mediaId } = posCustomerDisplayMediaParamsSchema.parse(request.params);
    const value = posCustomerDisplayMutationSchema.parse(request.body);
    const actor = requireAuthenticatedRequestUser(request);
    const result = await softDeletePosCustomerDisplayMedia({
      warehouseId,
      mediaId,
      actorId: actor.id,
      expectedVersion: value.expected_version,
      actionTime: value.action_time,
      authorization: requireRequestAuthorization(request),
      auditMetadata: getAuditRequestMetadata(request),
      source: "JPULSE",
    });
    return sendSuccess(response, result, {
      vi: "Đã xóa tệp khỏi playlist quảng cáo.",
      zh: "广告文件已从播放列表移除。",
    });
  } catch (error) {
    return handlePosCustomerDisplayError(response, error);
  }
};
