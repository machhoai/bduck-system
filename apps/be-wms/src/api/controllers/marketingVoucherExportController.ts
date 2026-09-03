import {
  createMarketingVoucherExportDownloadSchema,
  createMarketingVoucherExportJobSchema,
  marketingVoucherJobParamsSchema,
} from "@bduck/shared-types";
import type { Request, Response } from "express";

import {
  createMarketingVoucherExport,
  createMarketingVoucherExportDownload,
} from "../../services/marketingVoucherExportService.js";
import { sendSuccess } from "../../utils/responseHelper.js";
import {
  requireAuthenticatedRequestUser,
  requireRequestAuthorization,
} from "../middlewares/requestAccessContext.js";

import {
  handleMarketingVoucherError,
  voucherAuditMetadata,
} from "./marketingVoucherControllerUtils.js";

export async function createMarketingVoucherExportHandler(
  req: Request,
  res: Response,
) {
  try {
    const request = createMarketingVoucherExportJobSchema.parse(req.body);
    const data = await createMarketingVoucherExport(
      request,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      voucherAuditMetadata(req),
    );
    return sendSuccess(
      res,
      data,
      { vi: "Đã xếp hàng xuất voucher.", zh: "优惠券导出任务已排队。" },
      202,
    );
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
}

export async function downloadMarketingVoucherExportHandler(
  req: Request,
  res: Response,
) {
  try {
    const { jobId } = marketingVoucherJobParamsSchema.parse(req.params);
    const request = createMarketingVoucherExportDownloadSchema.parse(req.body);
    const data = await createMarketingVoucherExportDownload(
      jobId,
      request,
      requireAuthenticatedRequestUser(req).id,
      requireRequestAuthorization(req),
      voucherAuditMetadata(req),
    );
    return sendSuccess(res, data, {
      vi: "Liên kết tải xuống đã sẵn sàng.",
      zh: "下载链接已准备就绪。",
    });
  } catch (error) {
    return handleMarketingVoucherError(res, error);
  }
}
