import { Router, type Router as ExpressRouter } from "express";
import {
  createFileTemplateHandler,
  getFileTemplatesHandler,
} from "../controllers/fileTemplateController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/",
  requireAnyScopedPermission("file_templates.view"),
  getFileTemplatesHandler,
);
router.post(
  "/",
  requireAnyScopedPermission("file_templates.upload"),
  createFileTemplateHandler,
);

export default router;
