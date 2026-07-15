import type { Request, Response } from "express";
import { z } from "zod";
import {
  createLocationSlot,
  deleteLocationSlot,
  fetchLocationSlotById,
  fetchLocationSlots,
  updateLocationSlot,
} from "../../services/locationSlotService.js";
import {
  deleteLocationSlotProduct,
  fetchLocationSlotProducts,
  upsertLocationSlotProduct,
} from "../../services/locationSlotProductService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  createLocationSlotSchema,
  idParamSchema,
  slotProductQuerySchema,
  slotQuerySchema,
  updateLocationSlotSchema,
  upsertLocationSlotProductSchema,
} from "../../utils/zodSchemas.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const handleSlotError = (res: Response, error: unknown) => {
  console.error("[locationSlotController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu đầu vào không hợp lệ.", zh: "输入数据无效。" },
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
    { vi: "Lỗi khi xử lý giá trong vị trí.", zh: "处理子库位时出错。" },
    500,
  );
};

export const getLocationSlotsHandler = async (req: Request, res: Response) => {
  try {
    const slots = await fetchLocationSlots(
      slotQuerySchema.parse(req.query),
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, slots, {
      vi: "Lấy danh sách giá thành công.",
      zh: "成功获取子库位列表。",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const getLocationSlotByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const slot = await fetchLocationSlotById(
      id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, slot, {
      vi: "Lấy thông tin giá thành công.",
      zh: "成功获取子库位信息。",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const createLocationSlotHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const slot = await createLocationSlot(
      createLocationSlotSchema.parse(req.body),
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(
      res,
      slot,
      { vi: "Tạo giá thành công.", zh: "成功创建子库位。" },
      201,
    );
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const updateLocationSlotHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await updateLocationSlot(
      id,
      updateLocationSlotSchema.parse(req.body),
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "Cập nhật giá thành công.",
      zh: "成功更新子库位。",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const deleteLocationSlotHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteLocationSlot(
      id,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "Xóa giá thành công.",
      zh: "成功删除子库位。",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const getLocationSlotProductsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const mappings = await fetchLocationSlotProducts(
      slotProductQuerySchema.parse(req.query),
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, mappings, {
      vi: "Lấy danh sách gán sản phẩm thành công.",
      zh: "成功获取产品映射列表。",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const upsertLocationSlotProductHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const mapping = await upsertLocationSlotProduct(
      upsertLocationSlotProductSchema.parse(req.body),
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, mapping, {
      vi: "Gán sản phẩm vào giá thành công.",
      zh: "成功将产品分配到子库位。",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};

export const deleteLocationSlotProductHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteLocationSlotProduct(
      id,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "Bỏ gán sản phẩm khỏi giá thành công.",
      zh: "成功移除产品映射。",
    });
  } catch (error) {
    return handleSlotError(res, error);
  }
};
