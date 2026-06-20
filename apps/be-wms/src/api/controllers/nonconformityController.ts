import type { Request, Response } from "express";
import { z } from "zod";
import {
  fetchNonconformities,
  fetchNonconformityDetail,
  resolveNonconformity,
} from "../../services/nonconformityService.js";
import {
  idParamSchema,
  nonconformityQuerySchema,
  resolveNonconformitySchema,
} from "../../utils/zodSchemas.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";

const getRequestUserId = (req: Request): string => {
  return (req as any).user?.id || "unknown";
};

const handleNonconformityError = (res: Response, error: unknown) => {
  console.error("[nonconformityController] error:", error);

  if (error instanceof z.ZodError) {
    return sendError(
      res,
      {
        vi: "Du lieu dau vao khong hop le.",
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
      vi: "Loi khi xu ly bao cao ngoai le ton kho.",
      zh: "处理库存异常报告时出错。",
    },
    500,
  );
};

export const getNonconformitiesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const filters = nonconformityQuerySchema.parse(req.query);
    const records = await fetchNonconformities(filters);

    return sendSuccess(res, records, {
      vi: "Lay danh sach bao cao ngoai le thanh cong.",
      zh: "成功获取异常报告列表。",
    });
  } catch (error) {
    return handleNonconformityError(res, error);
  }
};

export const getNonconformityByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const detail = await fetchNonconformityDetail(id);

    return sendSuccess(res, detail, {
      vi: "Lay chi tiet bao cao ngoai le thanh cong.",
      zh: "成功获取异常报告详情。",
    });
  } catch (error) {
    return handleNonconformityError(res, error);
  }
};

export const resolveNonconformityHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = idParamSchema.parse(req.params);
    const data = resolveNonconformitySchema.parse(req.body);

    await resolveNonconformity(
      id,
      {
        resolution_type: data.resolution_type,
        resolution_notes: data.resolution_notes ?? null,
        action_time: data.action_time,
      },
      getRequestUserId(req),
      getAuditRequestMetadata(req),
    );

    return sendSuccess(res, null, {
      vi: "Xu ly bao cao ngoai le thanh cong.",
      zh: "成功处理异常报告。",
    });
  } catch (error) {
    return handleNonconformityError(res, error);
  }
};
