import type { Request, Response } from "express";
import { z } from "zod";
import {
  createEmployeeProfile,
  deleteEmployeeProfile,
  fetchEmployeeProfileById,
  fetchEmployeeProfileByUserId,
  fetchEmployeeProfiles,
  updateEmployeeProfile,
} from "../../services/employeeProfileService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { mapFirebaseError } from "../../utils/firebaseErrorHandler.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  createEmployeeProfileSchema,
  updateEmployeeProfileSchema,
} from "../../utils/zodSchemas.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const profileIdParamSchema = z.object({ id: z.string().uuid() });

const handleEmployeeProfileError = (res: Response, error: unknown) => {
  console.error("[employeeProfileController] error:", error);

  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu hồ sơ nhân viên không hợp lệ.", zh: "员工档案数据无效。" },
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
    { vi: "Lỗi khi xử lý hồ sơ nhân viên.", zh: "处理员工档案时出错。" },
    500,
  );
};

export const getEmployeeProfilesHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const profiles = await fetchEmployeeProfiles(
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, profiles, {
      vi: "Lấy danh sách hồ sơ nhân viên thành công.",
      zh: "成功获取员工档案列表。",
    });
  } catch (error) {
    return handleEmployeeProfileError(res, error);
  }
};

export const getMyEmployeeProfileHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const actor = requireAuthenticatedRequestUser(req);
    const profile = await fetchEmployeeProfileByUserId(actor.id);
    return sendSuccess(res, profile, {
      vi: "Lấy hồ sơ cá nhân thành công.",
      zh: "成功获取个人档案。",
    });
  } catch (error) {
    return handleEmployeeProfileError(res, error);
  }
};

export const getEmployeeProfileByIdHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = profileIdParamSchema.parse(req.params);
    const profile = await fetchEmployeeProfileById(
      id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, profile, {
      vi: "Lấy hồ sơ nhân viên thành công.",
      zh: "成功获取员工档案。",
    });
  } catch (error) {
    return handleEmployeeProfileError(res, error);
  }
};

export const createEmployeeProfileHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = createEmployeeProfileSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const result = await createEmployeeProfile(
      data,
      actor.id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(
      res,
      result,
      { vi: "Tạo hồ sơ nhân viên thành công.", zh: "成功创建员工档案。" },
      201,
    );
  } catch (error) {
    return handleEmployeeProfileError(res, error);
  }
};

export const updateEmployeeProfileHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = profileIdParamSchema.parse(req.params);
    const data = updateEmployeeProfileSchema.parse(req.body);
    const actor = requireAuthenticatedRequestUser(req);
    const profile = await updateEmployeeProfile(
      id,
      data,
      actor.id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, profile, {
      vi: "Cập nhật hồ sơ nhân viên thành công.",
      zh: "成功更新员工档案。",
    });
  } catch (error) {
    return handleEmployeeProfileError(res, error);
  }
};

export const deleteEmployeeProfileHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { id } = profileIdParamSchema.parse(req.params);
    const actor = requireAuthenticatedRequestUser(req);
    await deleteEmployeeProfile(
      id,
      actor.id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, null, {
      vi: "Xóa mềm hồ sơ nhân viên thành công.",
      zh: "成功软删除员工档案。",
    });
  } catch (error) {
    return handleEmployeeProfileError(res, error);
  }
};
