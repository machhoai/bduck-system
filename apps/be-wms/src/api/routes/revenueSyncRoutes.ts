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
} from "../controllers/revenueSyncController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/sync/:period", syncRevenueHandler);
router.get("/cached/:period", getCachedRevenueHandler);

export default router;
