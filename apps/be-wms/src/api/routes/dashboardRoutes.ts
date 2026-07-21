import { Router, type Router as ExpressRouter } from "express";
import { getInventoryDashboardSummary } from "../controllers/dashboardController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);
router.get(
  "/summary",
  requireAnyScopedPermission("inventory.read"),
  getInventoryDashboardSummary,
);

export default router;
