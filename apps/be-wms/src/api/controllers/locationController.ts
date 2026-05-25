import type { Request, Response } from "express";
import { z } from "zod";
import {
  createLocation,
  deleteLocation,
  fetchLocationById,
  fetchLocations,
  updateLocation,
} from "../../services/locationService.js";
import {
  createLocationSchema,
  idParamSchema,
  warehouseIdQuerySchema,
} from "../../utils/zodSchemas.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  canReadWarehouse,
  type RequestUserContext,
} from "../../services/warehouseAccess.js";

const updateLocationSchema = createLocationSchema.partial();

const getRequestUser = (req: Request): RequestUserContext => {
  const user = (req as any).user || {};
  return {
    id: user.id || "unknown",
    permissions: user.permissions || {},
    roleNames: user.roleNames || [],
  };
};

const handleLocationError = (res: Response, error: unknown) => {
  console.error("[locationController] error:", error);

  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu đầu vào không hợp lệ.",
        zh: "输入数据无效。",
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
      vi: "Lỗi khi xử lý vị trí kho.",
      zh: "处理库位时出错。",
    },
    500,
  );
};

export const getLocationsHandler = async (req: Request, res: Response) => {
  try {
    const { warehouse_id } = warehouseIdQuerySchema.parse(req.query);
    const locations = await fetchLocations(warehouse_id);

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
    const location = await fetchLocationById(id);
    if (!canReadWarehouse(getRequestUser(req), location.warehouse_id)) {
      return sendError(
        res,
        {
          vi: "Bạn không có quyền xem vị trí thuộc kho này.",
          zh: "您无权查看此仓库的库位。",
        },
        403,
      );
    }

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
    const location = await createLocation(data, getRequestUser(req));

    return sendSuccess(
      res,
      location,
      {
        vi: "Tạo vị trí thành công.",
        zh: "成功创建库位。",
      },
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
    await updateLocation(id, data, getRequestUser(req));

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
    await deleteLocation(id, getRequestUser(req).id);

    return sendSuccess(res, null, {
      vi: "Xóa vị trí thành công.",
      zh: "成功删除库位。",
    });
  } catch (error) {
    return handleLocationError(res, error);
  }
};
