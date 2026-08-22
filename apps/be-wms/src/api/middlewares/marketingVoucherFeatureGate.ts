import { resolveMarketingVouchersFeatureEnabled } from "@bduck/shared-types";
import type { RequestHandler } from "express";

import { sendError } from "../../utils/responseHelper.js";

export const requireMarketingVouchersFeatureEnabled: RequestHandler = (
  _req,
  res,
  next,
) => {
  try {
    if (resolveMarketingVouchersFeatureEnabled(process.env.MARKETING_VOUCHERS_FEATURE_ENABLED)) {
      next();
      return;
    }
    sendError(
      res,
      {
        vi: "Chức năng voucher marketing chưa được mở chính thức.",
        zh: "营销优惠券功能尚未正式启用。",
      },
      503,
    );
  } catch (error) {
    console.error("[marketingVoucherFeatureGate] invalid configuration", error);
    sendError(
      res,
      {
        vi: "Cấu hình triển khai voucher marketing không hợp lệ.",
        zh: "营销优惠券部署配置无效。",
      },
      503,
    );
  }
};
