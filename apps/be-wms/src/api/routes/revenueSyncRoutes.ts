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

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/dashboard", getRevenueDashboardHandler);
router.get("/online-sales", getOnlineSalesReportHandler);
router.get("/sync/:period", syncRevenueHandler);
router.get("/cached/:period", getCachedRevenueHandler);
router.get("/order-details/:orderId", getOrderDetailsHandler);

export default router;
