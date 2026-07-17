import { Router, type Router as ExpressRouter } from "express";
import {
  createFileTemplateBundleHandler,
  deleteFileTemplateBundleHandler,
  getFileTemplateBundlesHandler,
  updateFileTemplateBundleHandler,
} from "../controllers/fileTemplateBundleController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();
router.use(requireAuth);
router.get(
  "/",
  requireAnyScopedPermission("file_templates.view"),
  getFileTemplateBundlesHandler,
);
router.post(
  "/",
  requireAnyScopedPermission("file_template_bundles.manage"),
  createFileTemplateBundleHandler,
);
router.patch(
  "/:id",
  requireAnyScopedPermission("file_template_bundles.manage"),
  updateFileTemplateBundleHandler,
);
router.delete(
  "/:id",
  requireAnyScopedPermission("file_template_bundles.manage"),
  deleteFileTemplateBundleHandler,
);

export default router;
