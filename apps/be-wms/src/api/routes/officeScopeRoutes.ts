import { Router, type Router as ExpressRouter } from "express";
import {
  getOfficeScopeHandler,
  getOfficeScopeHistoryHandler,
  listOfficeScopesHandler,
  retryOfficeScopeMaterializationHandler,
  updateOfficeScopeCeilingHandler,
  updateOfficeScopeHandler,
} from "../controllers/officeScopeController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  requireAnyScopedPermission,
  requirePermission,
  requireSystemAdmin,
} from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();
const officeId = (req: { params: Record<string, unknown> }) =>
  typeof req.params.officeId === "string" ? req.params.officeId : null;

router.use(requireAuth);
router.get(
  "/",
  requireAnyScopedPermission("office_scopes.read"),
  listOfficeScopesHandler,
);
router.post(
  "/:officeId/materializations/:revision/retry",
  requirePermission("office_scopes.write", officeId),
  retryOfficeScopeMaterializationHandler,
);
router.get(
  "/:officeId/history",
  requirePermission("office_scopes.read", officeId),
  getOfficeScopeHistoryHandler,
);
router.get(
  "/:officeId",
  requirePermission("office_scopes.read", officeId),
  getOfficeScopeHandler,
);
router.put(
  "/:officeId/ceiling",
  requireSystemAdmin,
  updateOfficeScopeCeilingHandler,
);
router.put(
  "/:officeId",
  requirePermission("office_scopes.write", officeId),
  updateOfficeScopeHandler,
);

export default router;
