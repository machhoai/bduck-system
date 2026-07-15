import type { Request, Response } from "express";
import { z } from "zod";
import {
  createInventory,
  deleteInventory,
  fetchInventory,
  fetchInventoryById,
  updateInventory,
} from "../../services/inventoryService.js";
import {
  createInventorySchema,
  updateInventorySchema,
  inventoryQuerySchema,
  idParamSchema,
} from "../../utils/zodSchemas.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------

const handleInventoryError = (res: Response, error: unknown) => {
  console.error("[inventoryController] error:", error);

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
      vi: "Lỗi khi xử lý tồn kho.",
      zh: "处理库存时出错。",
    },
    500,
  );
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const getInventoryHandler = async (req: Request, res: Response) => {
  try {
    const filters = inventoryQuerySchema.parse(req.query);
    const records = await fetchInventory(
      filters,
      requireRequestAuthorization(req),
    );

    return sendSuccess(res, records, {
      vi: "Lấy danh sách tồn kho thành công.",
      zh: "成功获取库存列表。",
    });
  } catch (error) {
    return handleInventoryError(res, error);
  }
};

export const getInventoryByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const record = await fetchInventoryById(
      id,
      requireRequestAuthorization(req),
    );

    return sendSuccess(res, record, {
      vi: "Lấy thông tin tồn kho thành công.",
      zh: "成功获取库存信息。",
    });
  } catch (error) {
    return handleInventoryError(res, error);
  }
};

export const createInventoryHandler = async (req: Request, res: Response) => {
  try {
    const data = createInventorySchema.parse(req.body);
    const record = await createInventory(
      data,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(
      res,
      record,
      {
        vi: "Tạo bản ghi tồn kho thành công.",
        zh: "成功创建库存记录。",
      },
      201,
    );
  } catch (error) {
    return handleInventoryError(res, error);
  }
};

export const updateInventoryHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateInventorySchema.parse(req.body);
    await updateInventory(
      id,
      data,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(res, null, {
      vi: "Cập nhật tồn kho thành công.",
      zh: "成功更新库存记录。",
    });
  } catch (error) {
    return handleInventoryError(res, error);
  }
};

export const deleteInventoryHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteInventory(
      id,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(res, null, {
      vi: "Xóa bản ghi tồn kho thành công.",
      zh: "成功删除库存记录。",
    });
  } catch (error) {
    return handleInventoryError(res, error);
  }
};
