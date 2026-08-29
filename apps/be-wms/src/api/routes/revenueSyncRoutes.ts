/**
 * Revenue Sync Routes
 *
 * Protected by requireAuth middleware.
 * GET /api/revenue/sync/:period  — trigger sync from JoyWorld
 * GET /api/revenue/cached/:period — read cached data only
 */

import { Router, type Router as ExpressRouter } from "express";

import { getOnlineSalesReportHandler } from "../controllers/onlineSalesReportController.js";
import {
  getOpenApiRevenueWarehousesHandler,
  getRevenueDashboardHandler,
} from "../controllers/revenueDashboardController.js";
import { exportRevenueHandler } from "../controllers/revenueExportController.js";
import {
  syncRevenueHandler,
  syncPartnerPosOrdersHandler,
  getCachedRevenueHandler,
  getOrderDetailsHandler,
} from "../controllers/revenueSyncController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/openapi-warehouses",
  requireAnyScopedPermission("revenue.read"),
  getOpenApiRevenueWarehousesHandler,
);
router.get(
  "/dashboard",
  requireAnyScopedPermission("revenue.read"),
  getRevenueDashboardHandler,
);
router.post(
  "/export",
  requireAnyScopedPermission("revenue.export"),
  exportRevenueHandler,
);
router.post(
  "/partner-pos-sync",
  requireAnyScopedPermission("revenue.sync"),
  syncPartnerPosOrdersHandler,
);
router.get(
  "/online-sales",
  requireAnyScopedPermission("revenue.read"),
  getOnlineSalesReportHandler,
);
router.get(
  "/sync/:period",
  requireAnyScopedPermission("revenue.sync"),
  syncRevenueHandler,
);
router.get(
  "/cached/:period",
  requireAnyScopedPermission("revenue.read"),
  getCachedRevenueHandler,
);
router.get(
  "/order-details/:orderId",
  requireAnyScopedPermission("revenue.read"),
  getOrderDetailsHandler,
);

export default router;
