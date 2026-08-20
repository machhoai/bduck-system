import { Router, type Router as ExpressRouter } from "express";

import {
  changeMarketingVoucherCampaignStatusHandler,
  createMarketingVoucherCampaignHandler,
  deleteMarketingVoucherCampaignHandler,
  extendMarketingVoucherCampaignHandler,
  getMarketingVoucherCampaignHandler,
  listMarketingVoucherCampaignsHandler,
  updateMarketingVoucherCampaignHandler,
} from "../controllers/marketingVoucherCampaignController.js";
import {
  generateMarketingVoucherCodesHandler,
  getMarketingVoucherCodeHandler,
  listMarketingVoucherCodesHandler,
  revokeMarketingVoucherCodesHandler,
} from "../controllers/marketingVoucherCodeController.js";
import {
  getMarketingVoucherJobHandler,
  listMarketingVoucherJobsHandler,
  processMarketingVoucherJobHandler,
  resumeMarketingVoucherJobHandler,
} from "../controllers/marketingVoucherJobController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireMarketingVouchersFeatureEnabled } from "../middlewares/marketingVoucherFeatureGate.js";
import { marketingVoucherMutationRateLimiter } from "../middlewares/rateLimitMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireMarketingVouchersFeatureEnabled);
router.post("/internal/jobs/:jobId/process", processMarketingVoucherJobHandler);

router.use(requireAuth);
router.get(
  "/campaigns",
  requireAnyScopedPermission("marketing_vouchers.read"),
  listMarketingVoucherCampaignsHandler,
);
router.get(
  "/campaigns/:campaignId",
  requireAnyScopedPermission("marketing_vouchers.read"),
  getMarketingVoucherCampaignHandler,
);
router.post(
  "/campaigns",
  marketingVoucherMutationRateLimiter,
  requireAnyScopedPermission([
    "marketing_vouchers.campaigns.write",
    "marketing_vouchers.codes.generate",
  ]),
  createMarketingVoucherCampaignHandler,
);
router.put(
  "/campaigns/:campaignId",
  marketingVoucherMutationRateLimiter,
  requireAnyScopedPermission("marketing_vouchers.campaigns.write"),
  updateMarketingVoucherCampaignHandler,
);
router.post(
  "/campaigns/:campaignId/status",
  marketingVoucherMutationRateLimiter,
  requireAnyScopedPermission("marketing_vouchers.campaigns.write"),
  changeMarketingVoucherCampaignStatusHandler,
);
router.post(
  "/campaigns/:campaignId/generate",
  marketingVoucherMutationRateLimiter,
  requireAnyScopedPermission("marketing_vouchers.codes.generate"),
  generateMarketingVoucherCodesHandler,
);
router.post(
  "/campaigns/:campaignId/extend",
  marketingVoucherMutationRateLimiter,
  requireAnyScopedPermission("marketing_vouchers.campaigns.extend"),
  extendMarketingVoucherCampaignHandler,
);
router.delete(
  "/campaigns/:campaignId",
  marketingVoucherMutationRateLimiter,
  requireAnyScopedPermission("marketing_vouchers.campaigns.write"),
  deleteMarketingVoucherCampaignHandler,
);
router.get(
  "/codes",
  requireAnyScopedPermission("marketing_vouchers.read"),
  listMarketingVoucherCodesHandler,
);
router.get(
  "/codes/:codeId",
  requireAnyScopedPermission("marketing_vouchers.read"),
  getMarketingVoucherCodeHandler,
);
router.post(
  "/codes/revoke",
  marketingVoucherMutationRateLimiter,
  requireAnyScopedPermission("marketing_vouchers.codes.revoke"),
  revokeMarketingVoucherCodesHandler,
);
router.get(
  "/jobs",
  requireAnyScopedPermission("marketing_vouchers.read"),
  listMarketingVoucherJobsHandler,
);
router.get(
  "/jobs/:jobId",
  requireAnyScopedPermission("marketing_vouchers.read"),
  getMarketingVoucherJobHandler,
);
router.post(
  "/jobs/:jobId/resume",
  marketingVoucherMutationRateLimiter,
  requireAnyScopedPermission([
    "marketing_vouchers.codes.generate",
    "marketing_vouchers.campaigns.extend",
    "marketing_vouchers.export",
    "marketing_vouchers.email.send",
  ]),
  resumeMarketingVoucherJobHandler,
);

export default router;
