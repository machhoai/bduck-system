import type { Request, Response } from "express";
import { z } from "zod";
import {
  createWarehouse,
  deleteWarehouse,
  fetchWarehouseById,
  fetchWarehouses,
  updateWarehouse,
} from "../../services/warehouseService.js";
import {
  createWarehouseSchema,
  idParamSchema,
} from "../../utils/zodSchemas.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const updateWarehouseSchema = createWarehouseSchema.partial();

const handleWarehouseError = (res: Response, error: unknown) => {
  console.error("[warehouseController] error:", error);

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
      vi: "Lỗi khi xử lý kho.",
      zh: "处理仓库时出错。",
    },
    500,
  );
};

export const getWarehousesHandler = async (req: Request, res: Response) => {
  try {
    const warehouses = await fetchWarehouses(requireRequestAuthorization(req));
    return sendSuccess(res, warehouses, {
      vi: "Lấy danh sách kho thành công.",
      zh: "成功获取仓库列表。",
    });
  } catch (error) {
    return handleWarehouseError(res, error);
  }
};

export const getWarehouseByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const warehouse = await fetchWarehouseById(
      id,
      requireRequestAuthorization(req),
    );

    return sendSuccess(res, warehouse, {
      vi: "Lấy thông tin kho thành công.",
      zh: "成功获取仓库信息。",
    });
  } catch (error) {
    return handleWarehouseError(res, error);
  }
};

export const createWarehouseHandler = async (req: Request, res: Response) => {
  try {
    const data = createWarehouseSchema.parse(req.body);
    const warehouse = await createWarehouse(
      data,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(
      res,
      warehouse,
      {
        vi: "Tạo kho thành công.",
        zh: "成功创建仓库。",
      },
      201,
    );
  } catch (error) {
    return handleWarehouseError(res, error);
  }
};

export const updateWarehouseHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateWarehouseSchema.parse(req.body);
    await updateWarehouse(
      id,
      data,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(res, null, {
      vi: "Cập nhật kho thành công.",
      zh: "成功更新仓库。",
    });
  } catch (error) {
    return handleWarehouseError(res, error);
  }
};

export const deleteWarehouseHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteWarehouse(
      id,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(res, null, {
      vi: "Xóa kho thành công.",
      zh: "成功删除仓库。",
    });
  } catch (error) {
    return handleWarehouseError(res, error);
  }
};
