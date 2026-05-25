import type { Request, Response } from "express";
import { z } from "zod";
import {
  createOrganization,
  deleteOrganization,
  fetchOrganizationById,
  fetchOrganizations,
  updateOrganization,
} from "../../services/organizationService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  createOrganizationSchema,
  idParamSchema,
} from "../../utils/zodSchemas.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";

const updateOrganizationSchema = createOrganizationSchema.partial();
const getRequestUserId = (req: Request) => (req as any).user?.id || "unknown";

const handleOrganizationError = (res: Response, error: unknown) => {
  console.error("[organizationController] error:", error);

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
      vi: "Lỗi khi xử lý tổ chức.",
      zh: "处理组织时出错。",
    },
    500,
  );
};

export const getOrganizationsHandler = async (_req: Request, res: Response) => {
  try {
    const organizations = await fetchOrganizations();

    return sendSuccess(res, organizations, {
      vi: "Lấy danh sách tổ chức thành công.",
      zh: "成功获取组织列表。",
    });
  } catch (error) {
    return handleOrganizationError(res, error);
  }
};

export const getOrganizationByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const organization = await fetchOrganizationById(id);

    return sendSuccess(res, organization, {
      vi: "Lấy thông tin tổ chức thành công.",
      zh: "成功获取组织信息。",
    });
  } catch (error) {
    return handleOrganizationError(res, error);
  }
};

export const createOrganizationHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = createOrganizationSchema.parse(req.body);
    const organization = await createOrganization(
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(
      res,
      organization,
      {
        vi: "Tạo tổ chức thành công.",
        zh: "成功创建组织。",
      },
      201,
    );
  } catch (error) {
    return handleOrganizationError(res, error);
  }
};

export const updateOrganizationHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = updateOrganizationSchema.parse(req.body);
    await updateOrganization(
      id,
      data,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(res, null, {
      vi: "Cập nhật tổ chức thành công.",
      zh: "成功更新组织。",
    });
  } catch (error) {
    return handleOrganizationError(res, error);
  }
};

export const deleteOrganizationHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    await deleteOrganization(
      id,
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(res, null, {
      vi: "Xóa tổ chức thành công.",
      zh: "成功删除组织。",
    });
  } catch (error) {
    return handleOrganizationError(res, error);
  }
};
