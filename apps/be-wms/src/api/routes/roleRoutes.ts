import { Router, type Router as ExpressRouter } from "express";
import {
  createRoleHandler,
  deleteRoleHandler,
  getRoleByIdHandler,
  getRolesHandler,
  updateRoleHandler,
} from "../controllers/roleController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", requirePermission("roles.read"), getRolesHandler);
router.get("/:id", requirePermission("roles.read"), getRoleByIdHandler);
router.post("/", requirePermission("roles.write"), createRoleHandler);
router.put("/:id", requirePermission("roles.write"), updateRoleHandler);
router.delete("/:id", requirePermission("roles.write"), deleteRoleHandler);

export default router;
