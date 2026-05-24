import type { Request, Response, NextFunction } from "express";
import {
  updateProductBomSchema,
  idParamSchema,
} from "../../utils/zodSchemas.js";
import {
  fetchBomByProductId,
  updateProductBom,
} from "../../services/productBomService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

const getRequestUserId = (req: Request) => (req as any).user?.id || "unknown";

const handleProductBomError = (res: Response, error: unknown) => {
  console.error("[productBomController] error:", error);

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
      vi: "Lỗi khi xử lý định mức vật tư.",
      zh: "处理物料清单时出错。",
    },
    500,
  );
};

export const getProductBomHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const boms = await fetchBomByProductId(id);

    sendSuccess(res, boms, {
      vi: "Lấy định mức vật tư thành công",
      zh: "成功获取物料清单",
    });
  } catch (error) {
    handleProductBomError(res, error);
  }
};

export const updateProductBomHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const { bom_items } = updateProductBomSchema.parse(req.body);
    const userId = getRequestUserId(req);

    await updateProductBom(id, bom_items, userId);

    sendSuccess(res, null, {
      vi: "Cập nhật định mức vật tư thành công",
      zh: "成功更新物料清单",
    });
  } catch (error) {
    handleProductBomError(res, error);
  }
};
