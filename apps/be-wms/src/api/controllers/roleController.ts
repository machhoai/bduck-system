import type { Request, Response } from "express";
import { z } from "zod";
import {
  createRole,
  deleteRole,
  fetchRoleById,
  fetchRoles,
  updateRole,
} from "../../services/roleService.js";
import {
  createRoleSchema,
  idParamSchema,
  updateRoleSchema,
} from "../../utils/zodSchemas.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";

const getRequestUserId = (req: Request) => (req as any).user?.id || "unknown";

const handleRoleError = (res: Response, error: unknown) => {
  console.error("[roleController] error:", error);

  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu role không hợp lệ.",
        zh: "角色数据无效。",
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
      vi: "Lỗi khi xử lý role.",
      zh: "处理角色时出错。",
    },
    500,
  );
};

export const getRolesHandler = async (_req: Request, res: Response) => {
  try {
    const roles = await fetchRoles();
    return sendSuccess(res, roles, {
      vi: "Lấy danh sách role thành công.",
      zh: "成功获取角色列表。",
    });
  } catch (error) {
    return handleRoleError(res, error);
  }
};

export const getRoleByIdHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const role = await fetchRoleById(id);

    return sendSuccess(res, role, {
      vi: "Lấy thông tin role thành công.",
      zh: "成功获取角色信息。",
    });
  } catch (error) {
    return handleRoleError(res, error);
  }
};

export const createRoleHandler = async (req: Request, res: Response) => {
  try {
    const data = createRoleSchema.parse(req.body);
    const role = await createRole(
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(
      res,
      role,
      {
        vi: "Tạo role thành công.",
        zh: "成功创建角色。",
      },
      201,
    );
  } catch (error) {
    return handleRoleError(res, error);
  }
};

export const updateRoleHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateRoleSchema.parse(req.body);
    await updateRole(
      id,
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(res, null, {
      vi: "Cập nhật role thành công.",
      zh: "成功更新角色。",
    });
  } catch (error) {
    return handleRoleError(res, error);
  }
};

export const deleteRoleHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteRole(id, getRequestUserId(req), getAuditRequestMetadata(req));

    return sendSuccess(res, null, {
      vi: "Xóa role thành công.",
      zh: "成功删除角色。",
    });
  } catch (error) {
    return handleRoleError(res, error);
  }
};
