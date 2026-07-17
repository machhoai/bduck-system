import { Router, type Router as ExpressRouter } from "express";
import {
  createRoleHandler,
  deleteRoleHandler,
  getRoleByIdHandler,
  getRolesHandler,
  updateRoleHandler,
} from "../controllers/roleController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireSystemAdmin } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", requireSystemAdmin, getRolesHandler);
router.get("/:id", requireSystemAdmin, getRoleByIdHandler);
router.post("/", requireSystemAdmin, createRoleHandler);
router.put("/:id", requireSystemAdmin, updateRoleHandler);
router.delete("/:id", requireSystemAdmin, deleteRoleHandler);

export default router;
