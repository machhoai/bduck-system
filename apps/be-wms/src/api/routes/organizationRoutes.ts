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
  requireSystemAdmin,
} from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/",
  requireAnyScopedPermission("organizations.read"),
  getOrganizationsHandler,
);
router.get(
  "/:id",
  requireAnyScopedPermission("organizations.read"),
  getOrganizationByIdHandler,
);
router.post("/", requireSystemAdmin, createOrganizationHandler);
router.put("/:id", requireSystemAdmin, updateOrganizationHandler);
router.delete("/:id", requireSystemAdmin, deleteOrganizationHandler);

export default router;
