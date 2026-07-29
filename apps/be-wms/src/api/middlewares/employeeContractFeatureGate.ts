import { resolveEmployeeContractsFeatureEnabled } from "@bduck/shared-types";
import type { RequestHandler } from "express";
import { sendError } from "../../utils/responseHelper.js";

export const requireEmployeeContractFeatureEnabled: RequestHandler = (
  _req,
  res,
  next,
) => {
  try {
    if (
      resolveEmployeeContractsFeatureEnabled(
        process.env.EMPLOYEE_CONTRACTS_FEATURE_ENABLED,
        process.env.NODE_ENV,
      )
    ) {
      next();
      return;
    }
    sendError(
      res,
      {
        vi: "Chức năng hợp đồng lao động chưa được mở chính thức.",
        zh: "劳动合同功能尚未正式启用。",
      },
      503,
    );
  } catch (error) {
    console.error(
      "[employeeContractFeatureGate] invalid rollout configuration",
      error,
    );
    sendError(
      res,
      {
        vi: "Cấu hình triển khai chức năng hợp đồng lao động không hợp lệ.",
        zh: "劳动合同功能部署配置无效。",
      },
      503,
    );
  }
};
