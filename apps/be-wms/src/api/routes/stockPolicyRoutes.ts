import { Router, type Router as ExpressRouter } from "express";
import {
  deleteStockPolicyHandler,
  getStockPoliciesHandler,
  upsertStockPolicyHandler,
} from "../controllers/stockPolicyController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/",
  requireAnyScopedPermission("inventory.read"),
  getStockPoliciesHandler,
);
router.post(
  "/",
  requireAnyScopedPermission("inventory.write"),
  upsertStockPolicyHandler,
);
router.delete(
  "/:id",
  requireAnyScopedPermission("inventory.write"),
  deleteStockPolicyHandler,
);

export default router;
