import type { Request, Response } from "express";
import { z } from "zod";

import type { MarketingVoucherRequestMetadata } from "../../services/marketingVoucherOperationContext.js";
import { getAuditRequestMetadata } from "../../utils/auditRequestMetadata.js";
import { mapFirebaseError } from "../../utils/firebaseErrorHandler.js";
import { sendError } from "../../utils/responseHelper.js";

export const voucherAuditMetadata = (
  req: Request,
): MarketingVoucherRequestMetadata => {
  const metadata = getAuditRequestMetadata(req);
  return {
    ip_address: metadata.ip_address,
    device_id: metadata.device_id,
    session_token: metadata.session_token,
  };
};

export const handleMarketingVoucherError = (res: Response, error: unknown) => {
  console.error("[marketingVoucherController]", error);
  if (error instanceof z.ZodError) {
    return sendError(
      res,
      { vi: "Dữ liệu voucher không hợp lệ.", zh: "优惠券数据无效。" },
      400,
      error.flatten(),
    );
  }
  const firebaseError = mapFirebaseError(error);
  if (firebaseError)
    return sendError(res, firebaseError.messages, firebaseError.statusCode);
  const known = error as {
    statusCode?: number;
    messages?: { vi: string; zh: string };
    data?: unknown;
    code?: string;
    message?: string;
  };
  return sendError(
    res,
    known.messages ?? {
      vi: "Không thể xử lý yêu cầu voucher.",
      zh: "无法处理优惠券请求。",
    },
    known.statusCode ?? 500,
    known.data ?? {
      code: known.code ?? known.message ?? "MARKETING_VOUCHER_ERROR",
    },
  );
};
