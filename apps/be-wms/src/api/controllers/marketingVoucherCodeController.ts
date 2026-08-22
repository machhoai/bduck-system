import {
  generateMarketingVoucherCodesSchema,
  marketingVoucherCampaignParamsSchema,
  marketingVoucherCodeParamsSchema,
  marketingVoucherCodeQuerySchema,
  revokeMarketingVoucherCodesSchema,
} from "@bduck/shared-types";
import type { Request, Response } from "express";

import {
  generateMarketingVoucherCodes,
  getMarketingVoucherCode,
  getMarketingVoucherCodes,
  revokeMarketingVoucherCodes,
} from "../../services/marketingVoucherCodeService.js";
import { sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

import {
  handleMarketingVoucherError,
  voucherAuditMetadata,
} from "./marketingVoucherControllerUtils.js";

export const listMarketingVoucherCodesHandler = async (req: Request, res: Response) => {
  try {
    const data = await getMarketingVoucherCodes(
      marketingVoucherCodeQuerySchema.parse(req.query),
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, { vi: "Đã tải kho mã voucher.", zh: "优惠券码库已加载。" });
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const getMarketingVoucherCodeHandler = async (req: Request, res: Response) => {
  try {
    const { codeId } = marketingVoucherCodeParamsSchema.parse(req.params);
    const data = await getMarketingVoucherCode(codeId, requireRequestAuthorization(req));
    return sendSuccess(res, data, { vi: "Đã tải mã voucher.", zh: "优惠券码已加载。" });
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const generateMarketingVoucherCodesHandler = async (req: Request, res: Response) => {
  try {
    const { campaignId } = marketingVoucherCampaignParamsSchema.parse(req.params);
    const request = generateMarketingVoucherCodesSchema.parse(req.body);
    const data = await generateMarketingVoucherCodes(
      campaignId,
      request,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      voucherAuditMetadata(req),
    );
    return sendSuccess(res, data, { vi: "Đã xếp hàng sinh thêm mã voucher.", zh: "追加券码生成任务已排队。" }, 202);
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const revokeMarketingVoucherCodesHandler = async (req: Request, res: Response) => {
  try {
    const request = revokeMarketingVoucherCodesSchema.parse(req.body);
    const data = await revokeMarketingVoucherCodes(
      request,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      voucherAuditMetadata(req),
    );
    return sendSuccess(res, data, { vi: "Đã vô hiệu các mã voucher hợp lệ.", zh: "符合条件的优惠券码已撤销。" });
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};
