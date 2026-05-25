import { Request, Response } from "express";
import { z } from "zod";
import {
  createCategory,
  fetchAllCategories,
  fetchCategoryById,
  updateCategory,
  deleteCategory,
} from "../../services/categoryService.js";
import { sendSuccess, sendError } from "../../utils/responseHelper.js";

// ── Zod Schemas ──────────────────────────────────────────────

const createCategorySchema = z.object({
  parent_id: z.string().uuid().nullable().optional().default(null),
  name: z.string().min(1, "Tên danh mục không được để trống"),
  code: z.string().min(1, "Mã danh mục không được để trống"),
  type: z.enum(["EQUIPMENT", "CONSUMABLE", "SOUVENIR_SALE", "SOUVENIR_GIFT"]),
  category_description: z.string().nullable().optional().default(null),
});

const updateCategorySchema = z.object({
  name: z.string().min(1).optional(),
  category_description: z.string().nullable().optional(),
  parent_id: z.string().uuid().nullable().optional(),
});

// ── Controller Handlers ──────────────────────────────────────

export const getCategories = async (_req: Request, res: Response) => {
  try {
    const categories = await fetchAllCategories();
    return sendSuccess(res, categories, {
      vi: "Lấy danh sách danh mục thành công.",
      zh: "获取类别列表成功。",
    });
  } catch (error: unknown) {
    console.error("[categoryController] getCategories error:", error);
    return sendError(
      res,
      {
        vi: "Lỗi khi lấy danh sách danh mục.",
        zh: "获取类别列表时出错。",
      },
      500,
    );
  }
};

export const getCategoryById = async (req: Request, res: Response) => {
  try {
    const category = await fetchCategoryById(req.params.id as string);
    return sendSuccess(res, category, {
      vi: "Lấy thông tin danh mục thành công.",
      zh: "获取类别信息成功。",
    });
  } catch (error: any) {
    console.error("[categoryController] getCategoryById error:", error);
    if (error.statusCode) {
      return sendError(res, error.messages, error.statusCode);
    }
    return sendError(
      res,
      {
        vi: "Lỗi khi lấy thông tin danh mục.",
        zh: "获取类别信息时出错。",
      },
      500,
    );
  }
};

export const postCategory = async (req: Request, res: Response) => {
  try {
    const parseResult = createCategorySchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(
        res,
        {
          vi: "Dữ liệu đầu vào không hợp lệ.",
          zh: "输入数据无效。",
        },
        400,
        parseResult.error.flatten(),
      );
    }

    const userId = (req as any).user?.id || "unknown";
    const category = await createCategory(parseResult.data, userId);

    return sendSuccess(
      res,
      category,
      {
        vi: "Tạo danh mục thành công.",
        zh: "创建类别成功。",
      },
      201,
    );
  } catch (error: any) {
    console.error("[categoryController] postCategory error:", error);
    if (error.statusCode) {
      return sendError(res, error.messages, error.statusCode);
    }
    return sendError(
      res,
      {
        vi: "Lỗi khi tạo danh mục.",
        zh: "创建类别时出错。",
      },
      500,
    );
  }
};

export const putCategory = async (req: Request, res: Response) => {
  try {
    const parseResult = updateCategorySchema.safeParse(req.body);
    if (!parseResult.success) {
      return sendError(
        res,
        {
          vi: "Dữ liệu đầu vào không hợp lệ.",
          zh: "输入数据无效。",
        },
        400,
        parseResult.error.flatten(),
      );
    }

    const userId = (req as any).user?.id || "unknown";
    await updateCategory(req.params.id as string, parseResult.data, userId);

    return sendSuccess(res, null, {
      vi: "Cập nhật danh mục thành công.",
      zh: "更新类别成功。",
    });
  } catch (error: any) {
    console.error("[categoryController] putCategory error:", error);
    if (error.statusCode) {
      return sendError(res, error.messages, error.statusCode);
    }
    return sendError(
      res,
      {
        vi: "Lỗi khi cập nhật danh mục.",
        zh: "更新类别时出错。",
      },
      500,
    );
  }
};

export const removeCategory = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || "unknown";
    await deleteCategory(req.params.id as string, userId);

    return sendSuccess(res, null, {
      vi: "Xóa danh mục thành công.",
      zh: "删除类别成功。",
    });
  } catch (error: any) {
    console.error("[categoryController] removeCategory error:", error);
    if (error.statusCode) {
      return sendError(res, error.messages, error.statusCode);
    }
    return sendError(
      res,
      {
        vi: "Lỗi khi xóa danh mục.",
        zh: "删除类别时出错。",
      },
      500,
    );
  }
};
