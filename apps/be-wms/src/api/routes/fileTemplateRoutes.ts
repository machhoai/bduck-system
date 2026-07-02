import { Router, type Router as ExpressRouter } from "express";
import {
  createFileTemplateHandler,
  deleteFileTemplateHandler,
  getFileTemplatesHandler,
  updateFileTemplateHandler,
  uploadNewVersionHandler,
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
router.patch(
  "/:id",
  requireAnyScopedPermission("file_templates.edit"),
  updateFileTemplateHandler,
);
router.delete(
  "/:id",
  requireAnyScopedPermission("file_templates.delete"),
  deleteFileTemplateHandler,
);
router.put(
  "/:id/version",
  requireAnyScopedPermission("file_templates.edit"),
  uploadNewVersionHandler,
);

export default router;
