import type { Request, Response } from "express";
import { z } from "zod";
import {
  createLocation,
  deleteLocation,
  fetchLocationById,
  fetchLocations,
  updateLocation,
} from "../../services/locationService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  createLocationSchema,
  idParamSchema,
  warehouseIdQuerySchema,
} from "../../utils/zodSchemas.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const updateLocationSchema = createLocationSchema.partial();

const handleLocationError = (res: Response, error: unknown) => {
  console.error("[locationController] error:", error);
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
    { vi: "Lỗi khi xử lý vị trí kho.", zh: "处理库位时出错。" },
    500,
  );
};

export const getLocationsHandler = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = warehouseIdQuerySchema.parse(req.query);
    const locations = await fetchLocations(
      requireRequestAuthorization(req),
      warehouse_id,
    );
    return sendSuccess(res, locations, {
      vi: "Lấy danh sách vị trí thành công.",
      zh: "成功获取库位列表。",
    });
  } catch (error) {
    return handleLocationError(res, error);
  }
};

export const getLocationByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const location = await fetchLocationById(
      id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, location, {
      vi: "Lấy thông tin vị trí thành công.",
      zh: "成功获取库位信息。",
    });
  } catch (error) {
    return handleLocationError(res, error);
  }
};

export const createLocationHandler = async (req: Request, res: Response) => {
  try {
    const data = createLocationSchema.parse(req.body);
    const location = await createLocation(
      data,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(
      res,
      location,
      { vi: "Tạo vị trí thành công.", zh: "成功创建库位。" },
      201,
    );
  } catch (error) {
    return handleLocationError(res, error);
  }
};

export const updateLocationHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateLocationSchema.parse(req.body);
    await updateLocation(
      id,
      data,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "Cập nhật vị trí thành công.",
      zh: "成功更新库位。",
    });
  } catch (error) {
    return handleLocationError(res, error);
  }
};

export const deleteLocationHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteLocation(
      id,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "Xóa vị trí thành công.",
      zh: "成功删除库位。",
    });
  } catch (error) {
    return handleLocationError(res, error);
  }
};
