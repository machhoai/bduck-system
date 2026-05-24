import type { Request, Response, NextFunction } from "express";
import { z } from "zod";
import {
  createProduct,
  fetchProducts,
  fetchProductById,
  updateProduct,
  deleteProduct,
} from "../../services/productService.js";
import {
  createProductSchema,
  idParamSchema,
  paginationSchema,
} from "../../utils/zodSchemas.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

// Schema for updating (omits code and is_serialized)
const updateProductSchema = createProductSchema.partial().omit({
  code: true,
  is_serialized: true,
});

const getRequestUserId = (req: Request) => (req as any).user?.id || "unknown";

const handleProductError = (res: Response, error: unknown) => {
  console.error("[productController] error:", error);

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
      vi: "Lỗi khi xử lý sản phẩm.",
      zh: "处理产品时出错。",
    },
    500,
  );
};

export const getProductsHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { page, limit } = paginationSchema.parse(req.query);
    const categoryId = req.query.category_id as string | undefined;

    const result = await fetchProducts(page, limit, categoryId);

    sendSuccess(res, result, {
      vi: "Lấy danh sách sản phẩm thành công",
      zh: "成功获取产品列表",
    });
  } catch (error) {
    handleProductError(res, error);
  }
};

export const getProductByIdHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const product = await fetchProductById(id);

    sendSuccess(res, product, {
      vi: "Lấy thông tin sản phẩm thành công",
      zh: "成功获取产品信息",
    });
  } catch (error) {
    handleProductError(res, error);
  }
};

export const createProductHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const data = createProductSchema.parse(req.body);
    const userId = getRequestUserId(req);

    const product = await createProduct(data, userId);

    sendSuccess(res, product, {
      vi: "Tạo sản phẩm thành công",
      zh: "成功创建产品",
    });
  } catch (error) {
    handleProductError(res, error);
  }
};

export const updateProductHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateProductSchema.parse(req.body);
    const userId = getRequestUserId(req);

    await updateProduct(id, data, userId);

    sendSuccess(res, null, {
      vi: "Cập nhật sản phẩm thành công",
      zh: "成功更新产品",
    });
  } catch (error) {
    handleProductError(res, error);
  }
};

export const deleteProductHandler = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const userId = getRequestUserId(req);

    await deleteProduct(id, userId);

    sendSuccess(res, null, {
      vi: "Xóa sản phẩm thành công",
      zh: "成功删除产品",
    });
  } catch (error) {
    handleProductError(res, error);
  }
};
