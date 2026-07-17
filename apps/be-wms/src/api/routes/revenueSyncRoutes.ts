/**
 * Revenue Sync Routes
 *
 * Protected by requireAuth middleware.
 * GET /api/revenue/sync/:period  — trigger sync from JoyWorld
 * GET /api/revenue/cached/:period — read cached data only
 */

import { Router, type Router as ExpressRouter } from "express";
import {
  syncRevenueHandler,
  getCachedRevenueHandler,
  getOrderDetailsHandler,
} from "../controllers/revenueSyncController.js";
import { getRevenueDashboardHandler } from "../controllers/revenueDashboardController.js";
import { getOnlineSalesReportHandler } from "../controllers/onlineSalesReportController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/dashboard",
  requireAnyScopedPermission("revenue.read"),
  getRevenueDashboardHandler,
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
