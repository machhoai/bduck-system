import {
  marketingVoucherJobParamsSchema,
  marketingVoucherJobQuerySchema,
  resumeMarketingVoucherJobSchema,
} from "@bduck/shared-types";
import type { Request, Response } from "express";

import {
  getMarketingVoucherJob,
  getMarketingVoucherJobs,
  processMarketingVoucherJob,
  resumeMarketingVoucherJob,
} from "../../services/marketingVoucherJobService.js";
import { sendError, sendSuccess } from "../../utils/responseHelper.js";
import {
  hasNonEmptySecret,
  securelyMatchesSecret,
} from "../../utils/secureSecret.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

import {
  handleMarketingVoucherError,
  voucherAuditMetadata,
} from "./marketingVoucherControllerUtils.js";

const assertWorker = (req: Request, res: Response) => {
  const secret = process.env.MARKETING_VOUCHER_WORKER_SECRET;
  if (!hasNonEmptySecret(secret)) {
    sendError(
      res,
      { vi: "Chưa cấu hình worker voucher.", zh: "尚未配置优惠券工作器。" },
      503,
    );
    return false;
  }
  if (
    !securelyMatchesSecret(
      req.header("x-marketing-voucher-worker-secret"),
      secret,
    )
  ) {
    sendError(
      res,
      {
        vi: "Worker voucher không được xác thực.",
        zh: "优惠券工作器身份验证失败。",
      },
      401,
    );
    return false;
  }
  return true;
};

export const listMarketingVoucherJobsHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const data = await getMarketingVoucherJobs(
      marketingVoucherJobQuerySchema.parse(req.query),
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải danh sách job voucher.",
      zh: "优惠券任务列表已加载。",
    });
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const getMarketingVoucherJobHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { jobId } = marketingVoucherJobParamsSchema.parse(req.params);
    const data = await getMarketingVoucherJob(
      jobId,
      requireRequestAuthorization(req),
    );
    return sendSuccess(res, data, {
      vi: "Đã tải job voucher.",
      zh: "优惠券任务已加载。",
    });
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const resumeMarketingVoucherJobHandler = async (
  req: Request,
  res: Response,
) => {
  try {
    const { jobId } = marketingVoucherJobParamsSchema.parse(req.params);
    const request = resumeMarketingVoucherJobSchema.parse(req.body);
    const data = await resumeMarketingVoucherJob(
      jobId,
      request,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      voucherAuditMetadata(req),
    );
    return sendSuccess(
      res,
      data,
      { vi: "Đã tiếp tục job voucher.", zh: "优惠券任务已恢复。" },
      202,
    );
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};

export const processMarketingVoucherJobHandler = async (
  req: Request,
  res: Response,
) => {
  if (!assertWorker(req, res)) return;
  try {
    const { jobId } = marketingVoucherJobParamsSchema.parse(req.params);
    const data = await processMarketingVoucherJob(jobId);
    return sendSuccess(res, data, {
      vi: "Đã xử lý một chunk voucher.",
      zh: "优惠券任务分块已处理。",
    });
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
};
