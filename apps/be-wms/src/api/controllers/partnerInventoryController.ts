import type { Request, Response } from "express";
import { z } from "zod";

import { findPartnerInventoryJob } from "../../repositories/partnerInventoryRepository.js";
import { createPartnerInventoryComparison } from "../../services/partnerInventoryComparisonService.js";
import {
  fetchCategoryMapping,
  fetchPartnerInventoryMetadata,
  fetchWarehouseMapping,
  updateCategoryMapping,
  updateWarehouseMapping,
} from "../../services/partnerInventoryMappingService.js";
import { reconcilePartnerInventoryJob } from "../../services/partnerInventoryReconciliationService.js";
import {
  categoryMappingParamsSchema,
  createComparisonSchema,
  createSyncJobSchema,
  saveCategoryMappingSchema,
  saveWarehouseMappingSchema,
  warehouseMappingParamsSchema,
} from "../../services/partnerInventorySchemas.js";
import { synchronizePartnerInventory } from "../../services/partnerInventorySyncService.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

const errors: Record<string, { status: number; vi: string; zh: string }> = {
  AUTHORIZATION_DENIED: {
    status: 403,
    vi: "Bạn không có quyền thực hiện thao tác này.",
    zh: "您无权执行此操作。",
  },
  CATEGORY_NOT_FOUND: {
    status: 404,
    vi: "Không tìm thấy danh mục JPULSE.",
    zh: "未找到 JPULSE 分类。",
  },
  JOYWORLD_MANAGER_NOT_CONFIGURED: {
    status: 503,
    vi: "Kết nối quản trị JoyWorld chưa được cấu hình.",
    zh: "JoyWorld 管理连接尚未配置。",
  },
  JOYWORLD_MANAGER_INSECURE_HTTP_BLOCKED: {
    status: 503,
    vi: "Kết nối JoyWorld HTTP không an toàn đang bị chặn.",
    zh: "不安全的 JoyWorld HTTP 连接已被阻止。",
  },
  PARTNER_STOCK_ALREADY_MAPPED: {
    status: 409,
    vi: "Kho JoyWorld này đã được mapping với một kho JPULSE khác.",
    zh: "该 JoyWorld 仓库已映射到另一个 JPULSE 仓库。",
  },
  PARTNER_STOCK_NOT_FOUND: {
    status: 404,
    vi: "Không tìm thấy kho JoyWorld đã chọn.",
    zh: "未找到所选 JoyWorld 仓库。",
  },
  PARTNER_GIFT_TYPE_NOT_FOUND: {
    status: 404,
    vi: "Không tìm thấy nhóm hàng JoyWorld đã chọn.",
    zh: "未找到所选 JoyWorld 商品分组。",
  },
  PARTNER_WAREHOUSE_NOT_MAPPED: {
    status: 409,
    vi: "Kho JPULSE chưa được mapping với kho JoyWorld.",
    zh: "JPULSE 仓库尚未映射到 JoyWorld 仓库。",
  },
  PARTNER_WRITE_DISABLED: {
    status: 503,
    vi: "Chức năng ghi tồn JoyWorld đang bị tắt bởi cấu hình an toàn.",
    zh: "JoyWorld 库存写入功能已被安全配置关闭。",
  },
  PARTNER_SNAPSHOT_NOT_FOUND: {
    status: 404,
    vi: "Không tìm thấy bản đối chiếu tồn kho.",
    zh: "未找到库存核对快照。",
  },
  PARTNER_SNAPSHOT_EXPIRED: {
    status: 409,
    vi: "Số liệu đối chiếu đã hết hạn. Vui lòng đóng và mở lại cửa sổ đồng bộ.",
    zh: "核对数据已过期，请关闭并重新打开同步窗口。",
  },
  PARTNER_MAPPING_CHANGED: {
    status: 409,
    vi: "Mapping kho đã thay đổi sau khi lấy số liệu. Vui lòng tải lại.",
    zh: "获取数据后仓库映射已更改，请重新加载。",
  },
  PARTNER_SELECTION_NOT_ELIGIBLE: {
    status: 400,
    vi: "Danh sách có sản phẩm không đủ điều kiện đồng bộ.",
    zh: "所选列表包含不符合同步条件的商品。",
  },
  PARTNER_SYNC_IN_PROGRESS: {
    status: 409,
    vi: "Kho này đang có một lượt đồng bộ khác. Vui lòng thử lại sau khi lượt đó hoàn tất.",
    zh: "该仓库正在执行另一项同步，请在其完成后重试。",
  },
  PARTNER_SYNC_NEEDS_ATTENTION: {
    status: 409,
    vi: "Kho này có kết quả đồng bộ chưa xác định. Cần đối soát JoyWorld trước khi gửi lượt mới.",
    zh: "该仓库存在结果不明的同步，必须先核对 JoyWorld 才能再次发送。",
  },
  PARTNER_JOB_NOT_FOUND: {
    status: 404,
    vi: "Không tìm thấy tác vụ đồng bộ tồn kho.",
    zh: "未找到库存同步任务。",
  },
  IDEMPOTENCY_PAYLOAD_CONFLICT: {
    status: 409,
    vi: "Mã yêu cầu đã được dùng với một nội dung đồng bộ khác.",
    zh: "该请求编号已用于其他同步内容。",
  },
};

const handleError = (res: Response, error: unknown) => {
  console.error("[partnerInventoryController] error:", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu đầu vào không hợp lệ.", zh: "输入数据无效。" },
      400,
      error.flatten(),
    );
  }
  const code = error instanceof Error ? error.message : "";
  const known = errors[code];
  if (known) {
    return sendError(res, { vi: known.vi, zh: known.zh }, known.status);
  }
  return sendError(
    res,
    {
      vi: "Không thể xử lý yêu cầu đồng bộ kho JoyWorld.",
      zh: "无法处理 JoyWorld 库存同步请求。",
    },
    502,
  );
};

export const getPartnerMetadataHandler = async (_req: Request, res: Response) => {
  try {
    return sendSuccess(res, await fetchPartnerInventoryMetadata(), {
      vi: "Lấy danh mục JoyWorld thành công.",
      zh: "成功获取 JoyWorld 目录。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getWarehouseMappingHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseMappingParamsSchema.parse(req.params);
    const data = await fetchWarehouseMapping(
      warehouseId,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data);
  } catch (error) {
    return handleError(res, error);
  }
};

export const putWarehouseMappingHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseMappingParamsSchema.parse(req.params);
    const body = saveWarehouseMappingSchema.parse(req.body);
    const data = await updateWarehouseMapping(
      warehouseId,
      body.partner_stock_id,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã lưu mapping kho JoyWorld.",
      zh: "已保存 JoyWorld 仓库映射。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getCategoryMappingHandler = async (req: Request, res: Response) => {
  try {
    const { categoryId } = categoryMappingParamsSchema.parse(req.params);
    return sendSuccess(
      res,
      await fetchCategoryMapping(categoryId, requireRequestAuthorization(req)),
    );
  } catch (error) {
    return handleError(res, error);
  }
};

export const putCategoryMappingHandler = async (req: Request, res: Response) => {
  try {
    const { categoryId } = categoryMappingParamsSchema.parse(req.params);
    const body = saveCategoryMappingSchema.parse(req.body);
    const data = await updateCategoryMapping(
      categoryId,
      body.partner_type_id,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã lưu mapping nhóm hàng JoyWorld.",
      zh: "已保存 JoyWorld 商品分组映射。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const createComparisonHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseMappingParamsSchema.parse(req.params);
    createComparisonSchema.parse(req.body);
    const data = await createPartnerInventoryComparison(
      warehouseId,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã lấy số liệu đối chiếu mới nhất từ JoyWorld.",
      zh: "已获取最新的 JoyWorld 库存核对数据。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const createSyncJobHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseMappingParamsSchema.parse(req.params);
    const body = createSyncJobSchema.parse(req.body);
    const data = await synchronizePartnerInventory(
      warehouseId,
      body,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã xử lý yêu cầu đồng bộ tồn JoyWorld.",
      zh: "已处理 JoyWorld 库存同步请求。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};

export const getSyncJobHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseMappingParamsSchema.parse(req.params);
    const requestId = z.string().uuid().parse(req.params.requestId);
    requireRequestAuthorization(req).assert("partner_inventory.read", warehouseId);
    const job = await findPartnerInventoryJob(requestId);
    if (!job || job.warehouse_id !== warehouseId) {
      return sendError(
        res,
        { vi: "Không tìm thấy tác vụ đồng bộ.", zh: "未找到同步任务。" },
        404,
      );
    }
    const { payload_fingerprint: _fingerprint, ...data } = job;
    return sendSuccess(res, data);
  } catch (error) {
    return handleError(res, error);
  }
};

export const reconcileSyncJobHandler = async (req: Request, res: Response) => {
  try {
    const { warehouseId } = warehouseMappingParamsSchema.parse(req.params);
    const requestId = z.string().uuid().parse(req.params.requestId);
    const data = await reconcilePartnerInventoryJob(
      warehouseId,
      requestId,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      getAuditRequestMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã đối soát lại kết quả đồng bộ từ JoyWorld.",
      zh: "已重新核对 JoyWorld 同步结果。",
    });
  } catch (error) {
    return handleError(res, error);
  }
};
