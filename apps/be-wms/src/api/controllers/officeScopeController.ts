import type { Request, Response } from "express";
import { z } from "zod";
import {
  fetchOfficeScope,
  fetchOfficeScopeHistory,
  retryOfficeScopeMaterialization,
  updateOfficeScopeCeiling,
  updateOfficeScope,
} from "../../services/officeScopeService.js";
import { fetchOfficeScopeOverview } from "../../services/officeScopeOverviewService.js";
import {
  facilityAccessIdSchema,
  officeScopeCeilingMutationSchema,
  officeScopeMutationSchema,
} from "../../utils/facilityAccessSchemas.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const paramsSchema = z.object({ officeId: facilityAccessIdSchema });
const historyQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
const materializationParamsSchema = z.object({
  officeId: facilityAccessIdSchema,
  revision: z.coerce.number().int().min(1),
});

const handleError = (res: Response, error: unknown) => {
  console.error("[officeScopeController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Dữ liệu phạm vi văn phòng không hợp lệ.",
        zh: "办公室范围数据无效。",
      },
      400,
      error.flatten(),
    );
  }
  const apiError = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
  };
  return sendError(
    res,
    apiError.messages ?? {
      vi: "Không thể xử lý phạm vi quản lý của văn phòng.",
      zh: "无法处理办公室管理范围。",
    },
    apiError.statusCode ?? 500,
  );
};

export const getOfficeScopeHandler = async (req: Request, res: Response) => {
  try {
    const { officeId } = paramsSchema.parse(req.params);
    const data = await fetchOfficeScope(
      officeId,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Lấy phạm vi văn phòng thành công.",
      zh: "成功获取办公室范围。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getOfficeScopeHistoryHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { officeId } = paramsSchema.parse(req.params);
    const { limit } = historyQuerySchema.parse(req.query);
    const data = await fetchOfficeScopeHistory(
      officeId,
      requireRequestAuthorization(req),
      limit,
    );
    return sendSuccess(res, data, {
      vi: "Lấy lịch sử phạm vi văn phòng thành công.",
      zh: "成功获取办公室范围历史记录。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const retryOfficeScopeMaterializationHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { officeId, revision } = materializationParamsSchema.parse(
      req.params,
    );
    const data = await retryOfficeScopeMaterialization(
      officeId,
      revision,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã thử áp dụng lại quyền cho các nhân sự bị lỗi.",
      zh: "已重试为失败员工应用权限。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listOfficeScopesHandler = async (req: Request, res: Response) => {
  try {
    const data = await fetchOfficeScopeOverview(
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Lấy danh sách phạm vi văn phòng thành công.",
      zh: "成功获取办公室管理范围列表。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateOfficeScopeHandler = async (req: Request, res: Response) => {
  try {
    const { officeId } = paramsSchema.parse(req.params);
    const input = officeScopeMutationSchema.parse(req.body);
    const data = await updateOfficeScope(
      officeId,
      input,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Cập nhật phạm vi văn phòng thành công.",
      zh: "办公室范围更新成功。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateOfficeScopeCeilingHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { officeId } = paramsSchema.parse(req.params);
    const input = officeScopeCeilingMutationSchema.parse(req.body);
    const data = await updateOfficeScopeCeiling(
      officeId,
      input,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Cập nhật trần quản trị phạm vi thành công.",
      zh: "管理范围上限更新成功。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
