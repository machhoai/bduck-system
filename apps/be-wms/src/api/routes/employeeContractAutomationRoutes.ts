import { Router, type Router as ExpressRouter } from "express";
import {
  listExpiringEmployeeContractsHandler,
  runEmployeeContractDailyAutomationHandler,
} from "../controllers/employeeContractAutomationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";
import { requireEmployeeContractFeatureEnabled } from "../middlewares/employeeContractFeatureGate.js";

const router: ExpressRouter = Router();

router.post(
  "/cron/daily-maintenance",
  requireEmployeeContractFeatureEnabled,
  runEmployeeContractDailyAutomationHandler,
);

router.use(requireAuth);
router.use(requireEmployeeContractFeatureEnabled);
router.get(
  "/expiring",
  requireAnyScopedPermission("employees.contracts.read"),
  listExpiringEmployeeContractsHandler,
);

export default router;
