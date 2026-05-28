import { Router, type Router as ExpressRouter } from "express";
import {
  createOrganizationHandler,
  deleteOrganizationHandler,
  getOrganizationByIdHandler,
  getOrganizationsHandler,
  updateOrganizationHandler,
} from "../controllers/organizationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  requireAnyScopedPermission,
  requirePermission,
} from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", requireAnyScopedPermission("organizations.read"), getOrganizationsHandler);
router.get(
  "/:id",
  requireAnyScopedPermission("organizations.read"),
  getOrganizationByIdHandler,
);
router.post("/", requirePermission("organizations.write"), createOrganizationHandler);
router.put("/:id", requirePermission("organizations.write"), updateOrganizationHandler);
router.delete(
  "/:id",
  requirePermission("organizations.write"),
  deleteOrganizationHandler,
);

export default router;
