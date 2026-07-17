import { Router, type Router as ExpressRouter } from "express";
import {
  createExcelReportTemplateHandler,
  downloadReportTemplateFileHandler,
  exportExcelReportHandler,
  getReportTemplateHandler,
  listReportTemplatesHandler,
  previewExcelReportHandler,
  updateExcelReportTemplateHandler,
} from "../controllers/reportController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/templates",
  requireAnyScopedPermission("reports.templates.read"),
  listReportTemplatesHandler,
);
router.post(
  "/templates/excel",
  requireAnyScopedPermission("reports.templates.write"),
  createExcelReportTemplateHandler,
);
router.get(
  "/templates/:id",
  requireAnyScopedPermission("reports.templates.read"),
  getReportTemplateHandler,
);
router.get(
  "/templates/:id/file",
  requireAnyScopedPermission("reports.templates.read"),
  downloadReportTemplateFileHandler,
);
router.put(
  "/templates/:id/excel",
  requireAnyScopedPermission("reports.templates.write"),
  updateExcelReportTemplateHandler,
);
router.post(
  "/templates/:id/preview",
  requireAnyScopedPermission("reports.export"),
  previewExcelReportHandler,
);
router.post(
  "/templates/:id/export",
  requireAnyScopedPermission("reports.export"),
  exportExcelReportHandler,
);

export default router;
