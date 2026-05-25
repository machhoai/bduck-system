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

router.get("/", requireAnyScopedPermission("warehouses.read"), getOrganizationsHandler);
router.get(
  "/:id",
  requireAnyScopedPermission("warehouses.read"),
  getOrganizationByIdHandler,
);
router.post("/", requirePermission("warehouses.write"), createOrganizationHandler);
router.put("/:id", requirePermission("warehouses.write"), updateOrganizationHandler);
router.delete(
  "/:id",
  requirePermission("warehouses.write"),
  deleteOrganizationHandler,
);

export default router;
