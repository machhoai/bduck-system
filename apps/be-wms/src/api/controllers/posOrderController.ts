import type { Request, Response } from "express";
import { z } from "zod";

import { PosOrderError } from "../../services/posOrderErrors.js";
import {
  posOrderCancelSchema,
  posOrderListQuerySchema,
  posOrderParamsSchema,
} from "../../services/posOrderSchemas.js";
import {
  cancelPosOrder,
  getPosOrder,
  getPosOrderRefundPreview,
  listPosOrders,
} from "../../services/posOrderService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const handleError = (response: Response, error: unknown) => {
  console.error("[posOrderController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      response,
      { vi: "Dữ liệu đơn hàng không hợp lệ.", zh: "订单数据无效。" },
      400,
      error.flatten(),
    );
  }
  if (error instanceof PosOrderError) {
    return sendError(response, error.messages, error.statusCode, {
      code: error.code,
    });
  }
  return sendError(
    response,
    { vi: "Không thể xử lý đơn hàng POS.", zh: "无法处理 POS 订单。" },
    500,
  );
};

export const listPosOrdersHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const { warehouseId } = posOrderParamsSchema.parse(request.params);
    const query = posOrderListQuerySchema.parse(request.query);
    return sendSuccess(
      response,
      await listPosOrders({
        warehouseId,
        query,
        authorization: requireRequestAuthorization(request),
      }),
    );
  } catch (error) {
    return handleError(response, error);
  }
};

export const getPosOrderHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const { warehouseId, localOrderId } = posOrderParamsSchema.parse(
      request.params,
    );
    return sendSuccess(
      response,
      await getPosOrder({
        warehouseId,
        localOrderId: localOrderId!,
        authorization: requireRequestAuthorization(request),
      }),
    );
  } catch (error) {
    return handleError(response, error);
  }
};

export const getPosOrderRefundPreviewHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const { warehouseId, localOrderId } = posOrderParamsSchema.parse(
      request.params,
    );
    return sendSuccess(
      response,
      await getPosOrderRefundPreview({
        warehouseId,
        localOrderId: localOrderId!,
        authorization: requireRequestAuthorization(request),
      }),
    );
  } catch (error) {
    return handleError(response, error);
  }
};

export const cancelPosOrderHandler = async (
  request: Request,
  response: Response,
) => {
  try {
    const { warehouseId, localOrderId } = posOrderParamsSchema.parse(
      request.params,
    );
    const value = posOrderCancelSchema.parse(request.body);
    const actor = requireAuthenticatedRequestUser(request);
    return sendSuccess(
      response,
      await cancelPosOrder({
        warehouseId,
        localOrderId: localOrderId!,
        value,
        actorId: actor.id,
        actorName: actor.full_name || actor.username,
        authorization: requireRequestAuthorization(request),
        auditMetadata: getAuditRequestMetadata(request),
      }),
      { vi: "Đã xử lý hủy đơn hàng.", zh: "订单取消已处理。" },
    );
  } catch (error) {
    return handleError(response, error);
  }
};
