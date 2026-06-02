import type { Request, Response } from "express";
import { z } from "zod";
import {
  createUser,
  deleteUser,
  fetchUserById,
  fetchUsers,
  updateUser,
} from "../../services/userService.js";
import {
  createUserSchema,
  updateUserSchema,
} from "../../utils/zodSchemas.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";

const userIdParamSchema = z.object({ id: z.string().min(1) });
const getRequestUserId = (req: Request) => (req as any).user?.id || "unknown";

import { mapFirebaseError } from "../../utils/firebaseErrorHandler.js";

const handleUserError = (res: Response, error: unknown) => {
  console.error("[userController] error:", error);

  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu người dùng không hợp lệ.", zh: "用户数据无效。" },
      400,
      error.flatten(),
    );
  }

  const firebaseMapped = mapFirebaseError(error);
  if (firebaseMapped) {
    return sendError(res, firebaseMapped.messages, firebaseMapped.statusCode);
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
    { vi: "Lỗi khi xử lý người dùng.", zh: "处理用户时出错。" },
    500,
  );
};

export const getUsersHandler = async (_req: Request, res: Response) => {
  try {
    const users = await fetchUsers();
    return sendSuccess(res, users, {
      vi: "Lấy danh sách người dùng thành công.",
      zh: "成功获取用户列表。",
    });
  } catch (error) {
    return handleUserError(res, error);
  }
};

export const getUserByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const user = await fetchUserById(id);
    return sendSuccess(res, user, {
      vi: "Lấy người dùng thành công.",
      zh: "成功获取用户。",
    });
  } catch (error) {
    return handleUserError(res, error);
  }
};

export const createUserHandler = async (req: Request, res: Response) => {
  try {
    const data = createUserSchema.parse(req.body);
    const user = await createUser(
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(
      res,
      user,
      { vi: "Tạo người dùng thành công.", zh: "成功创建用户。" },
      201,
    );
  } catch (error) {
    return handleUserError(res, error);
  }
};

export const updateUserHandler = async (req: Request, res: Response) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    const data = updateUserSchema.parse(req.body);
    await updateUser(id, data, getRequestUserId(req), getAuditRequestMetadata(req));
    return sendSuccess(res, null, {
      vi: "Cập nhật người dùng thành công.",
      zh: "成功更新用户。",
    });
  } catch (error) {
    return handleUserError(res, error);
  }
};

export const deleteUserHandler = async (req: Request, res: Response) => {
  try {
    const { id } = userIdParamSchema.parse(req.params);
    await deleteUser(id, getRequestUserId(req), getAuditRequestMetadata(req));
    return sendSuccess(res, null, {
      vi: "Xóa mềm người dùng thành công.",
      zh: "成功软删除用户。",
    });
  } catch (error) {
    return handleUserError(res, error);
  }
};
