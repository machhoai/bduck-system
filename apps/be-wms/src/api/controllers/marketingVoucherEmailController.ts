import {
  createMarketingVoucherEmailJobSchema,
  marketingVoucherJobParamsSchema,
  retryMarketingVoucherJobItemsSchema,
} from "@bduck/shared-types";
import type { Request, Response } from "express";

import {
  createMarketingVoucherEmailJob,
  retryMarketingVoucherEmailItems,
} from "../../services/marketingVoucherEmailService.js";
import { sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

import {
  handleMarketingVoucherError,
  voucherAuditMetadata,
} from "./marketingVoucherControllerUtils.js";

export const createMarketingVoucherEmailJobHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const request = createMarketingVoucherEmailJobSchema.parse(req.body);
    const data = await createMarketingVoucherEmailJob(
      request,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      voucherAuditMetadata(req),
    );
    return sendSuccess(
      res,
      data,
      { vi: "Đã xếp hàng gửi email voucher.", zh: "优惠券邮件已加入队列。" },
      202,
    );
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const retryMarketingVoucherEmailItemsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { jobId } = marketingVoucherJobParamsSchema.parse(req.params);
    const request = retryMarketingVoucherJobItemsSchema.parse(req.body);
    const data = await retryMarketingVoucherEmailItems(
      jobId,
      request,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      voucherAuditMetadata(req),
    );
    return sendSuccess(
      res,
      data,
      { vi: "Đã xếp hàng gửi lại email lỗi.", zh: "失败邮件已重新加入队列。" },
      202,
    );
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};
