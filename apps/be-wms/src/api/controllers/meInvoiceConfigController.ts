import type { Request, Response } from "express";
import { z } from "zod";
import {
  meInvoiceAccountInputSchema,
  meInvoiceStoreConfigInputSchema,
} from "../../services/meInvoiceConfigSchemas.js";
import {
  listMeInvoiceAccounts,
  saveMeInvoiceAccount,
} from "../../services/meInvoiceConfigService.js";
import {
  getMeInvoiceStoreConfig,
  listMeInvoiceStoreAccountOptions,
  saveMeInvoiceStoreConfig,
} from "../../services/meInvoiceStoreConfigService.js";
import {
  testMeInvoiceAccount,
  validateMeInvoiceStoreConfig,
} from "../../services/meInvoiceConnectionService.js";
import { MeInvoiceApiError } from "../../services/meInvoiceClient.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const idParamsSchema = z.object({ id: z.string().uuid() });
const warehouseParamsSchema = z.object({ warehouseId: z.string().trim().min(1).max(200) });

const handleError = (res: Response, error: unknown) => {
  console.error("[meInvoiceConfigController]", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu cấu hình hóa đơn không hợp lệ.", zh: "发票配置数据无效。" },
      400,
      error.flatten(),
    );
  }
  if (error instanceof MeInvoiceApiError) {
    return sendError(
      res,
      {
        vi: "Không thể xác minh kết nối MISA meInvoice.",
        zh: "无法验证 MISA meInvoice 连接。",
      },
      400,
      { code: error.code },
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
      vi: "Không thể xử lý cấu hình MISA meInvoice.",
      zh: "无法处理 meInvoice 配置。",
    },
    500,
  );
};

export const listMeInvoiceAccountsHandler = async (req: Request, res: Response) => {
  try {
    const data = await listMeInvoiceAccounts(requireRequestAuthorization(req));
    return sendSuccess(res, data, { vi: "Đã tải tài khoản meInvoice.", zh: "已加载 meInvoice 账户。" });
  } catch (error) {
    return handleError(res, error);
  }
};

export const createMeInvoiceAccountHandler = async (req: Request, res: Response) => {
  try {
    const input = meInvoiceAccountInputSchema.parse(req.body);
    const data = await saveMeInvoiceAccount(
      null,
      input,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, { vi: "Đã tạo tài khoản meInvoice.", zh: "已创建 meInvoice 账户。" }, 201);
  } catch (error) {
    return handleError(res, error);
  }
};

export const updateMeInvoiceAccountHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const input = meInvoiceAccountInputSchema.parse(req.body);
    const data = await saveMeInvoiceAccount(
      id,
      input,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, { vi: "Đã cập nhật tài khoản meInvoice.", zh: "已更新 meInvoice 账户。" });
  } catch (error) {
    return handleError(res, error);
  }
};

export const testMeInvoiceAccountHandler = async (req: Request, res: Response) => {
  try {
    const { id } = idParamsSchema.parse(req.params);
    const data = await testMeInvoiceAccount(
      id,
      requireRequestAuthorization(req),
      requireAuthenticatedRequestUser(req).id,
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, { vi: "Kết nối meInvoice và tải mẫu thành công.", zh: "meInvoice 连接和模板加载成功。" });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getMeInvoiceStoreConfigHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseParamsSchema.parse(req.params);
    const data = await getMeInvoiceStoreConfig(warehouseId, requireRequestAuthorization(req));
    return sendSuccess(res, data, { vi: "Đã tải cấu hình hóa đơn cửa hàng.", zh: "已加载门店发票配置。" });
  } catch (error) {
    return handleError(res, error);
  }
};

export const listMeInvoiceStoreAccountOptionsHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseParamsSchema.parse(req.params);
    const data = await listMeInvoiceStoreAccountOptions(
      warehouseId,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải danh sách tài khoản meInvoice có thể cấu hình.",
      zh: "已加载可配置的 meInvoice 账户。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const saveMeInvoiceStoreConfigHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseParamsSchema.parse(req.params);
    const input = meInvoiceStoreConfigInputSchema.parse(req.body);
    const data = await saveMeInvoiceStoreConfig(
      warehouseId,
      input,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, { vi: "Đã lưu cấu hình hóa đơn cửa hàng.", zh: "已保存门店发票配置。" });
  } catch (error) {
    return handleError(res, error);
  }
};

export const validateMeInvoiceStoreConfigHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseParamsSchema.parse(req.params);
    const data = await validateMeInvoiceStoreConfig(
      warehouseId,
      requireRequestAuthorization(req),
      requireAuthenticatedRequestUser(req).id,
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, { vi: "Cấu hình và ký hiệu hóa đơn hợp lệ.", zh: "发票配置和系列有效。" });
  } catch (error) {
    return handleError(res, error);
  }
};
