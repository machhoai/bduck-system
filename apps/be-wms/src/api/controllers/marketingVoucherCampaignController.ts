import {
  changeMarketingVoucherCampaignStatusSchema,
  createMarketingVoucherCampaignSchema,
  deleteMarketingVoucherCampaignSchema,
  extendMarketingVoucherCampaignSchema,
  marketingVoucherCampaignParamsSchema,
  marketingVoucherCampaignQuerySchema,
  updateMarketingVoucherCampaignSchema,
} from "@bduck/shared-types";
import type { Request, Response } from "express";

import {
  changeMarketingVoucherCampaignStatus,
  createMarketingVoucherCampaign,
  deleteMarketingVoucherCampaign,
  extendMarketingVoucherCampaign,
  getMarketingVoucherCampaign,
  getMarketingVoucherCampaigns,
  updateMarketingVoucherCampaign,
} from "../../services/marketingVoucherCampaignService.js";
import { sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

import {
  handleMarketingVoucherError,
  voucherAuditMetadata,
} from "./marketingVoucherControllerUtils.js";

export const listMarketingVoucherCampaignsHandler = async (req: Request, res: Response) => {
  try {
    const data = await getMarketingVoucherCampaigns(
      marketingVoucherCampaignQuerySchema.parse(req.query),
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, { vi: "Đã tải danh sách chiến dịch.", zh: "优惠券活动列表已加载。" });
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const getMarketingVoucherCampaignHandler = async (req: Request, res: Response) => {
  try {
    const { campaignId } = marketingVoucherCampaignParamsSchema.parse(req.params);
    const data = await getMarketingVoucherCampaign(campaignId, requireRequestAuthorization(req));
    return sendSuccess(res, data, { vi: "Đã tải chiến dịch.", zh: "优惠券活动已加载。" });
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const createMarketingVoucherCampaignHandler = async (req: Request, res: Response) => {
  try {
    const request = createMarketingVoucherCampaignSchema.parse(req.body);
    const data = await createMarketingVoucherCampaign(
      request,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      voucherAuditMetadata(req),
    );
    return sendSuccess(
      res,
      data,
      { vi: "Đã tạo chiến dịch và xếp hàng sinh mã.", zh: "活动已创建并排队生成券码。" },
      201,
    );
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const updateMarketingVoucherCampaignHandler = async (req: Request, res: Response) => {
  try {
    const { campaignId } = marketingVoucherCampaignParamsSchema.parse(req.params);
    const request = updateMarketingVoucherCampaignSchema.parse(req.body);
    const data = await updateMarketingVoucherCampaign(
      campaignId,
      request,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      voucherAuditMetadata(req),
    );
    return sendSuccess(res, data, { vi: "Đã cập nhật chiến dịch.", zh: "优惠券活动已更新。" });
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const changeMarketingVoucherCampaignStatusHandler = async (req: Request, res: Response) => {
  try {
    const { campaignId } = marketingVoucherCampaignParamsSchema.parse(req.params);
    const request = changeMarketingVoucherCampaignStatusSchema.parse(req.body);
    const data = await changeMarketingVoucherCampaignStatus(
      campaignId,
      request,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      voucherAuditMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: request.status === "PAUSED" ? "Đã tạm dừng chiến dịch." : "Đã kích hoạt chiến dịch.",
      zh: request.status === "PAUSED" ? "活动已暂停。" : "活动已启用。",
    });
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const extendMarketingVoucherCampaignHandler = async (req: Request, res: Response) => {
  try {
    const { campaignId } = marketingVoucherCampaignParamsSchema.parse(req.params);
    const request = extendMarketingVoucherCampaignSchema.parse(req.body);
    const data = await extendMarketingVoucherCampaign(
      campaignId,
      request,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      voucherAuditMetadata(req),
    );
    return sendSuccess(res, data, { vi: "Đã xếp hàng gia hạn chiến dịch.", zh: "活动延期任务已排队。" }, 202);
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const deleteMarketingVoucherCampaignHandler = async (req: Request, res: Response) => {
  try {
    const { campaignId } = marketingVoucherCampaignParamsSchema.parse(req.params);
    const request = deleteMarketingVoucherCampaignSchema.parse(req.body);
    const data = await deleteMarketingVoucherCampaign(
      campaignId,
      request,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      voucherAuditMetadata(req),
    );
    return sendSuccess(res, data, { vi: "Đã kết thúc và ẩn chiến dịch.", zh: "活动已结束并隐藏。" });
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};
