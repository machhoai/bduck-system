import { Router, type Router as ExpressRouter } from "express";
import {
  deleteStockPolicyHandler,
  getStockPoliciesHandler,
  upsertStockPolicyHandler,
} from "../controllers/stockPolicyController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", requirePermission("inventory.read"), getStockPoliciesHandler);
router.post(
  "/",
  requirePermission("inventory.write"),
  upsertStockPolicyHandler,
);
router.delete(
  "/:id",
  requirePermission("inventory.write"),
  deleteStockPolicyHandler,
);

export default router;
