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
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/templates",
  requirePermission("reports.templates.read"),
  listReportTemplatesHandler,
);
router.post(
  "/templates/excel",
  requirePermission("reports.templates.write"),
  createExcelReportTemplateHandler,
);
router.get(
  "/templates/:id",
  requirePermission("reports.templates.read"),
  getReportTemplateHandler,
);
router.get(
  "/templates/:id/file",
  requirePermission("reports.templates.read"),
  downloadReportTemplateFileHandler,
);
router.put(
  "/templates/:id/excel",
  requirePermission("reports.templates.write"),
  updateExcelReportTemplateHandler,
);
router.post(
  "/templates/:id/preview",
  requirePermission("reports.export"),
  previewExcelReportHandler,
);
router.post(
  "/templates/:id/export",
  requirePermission("reports.export"),
  exportExcelReportHandler,
);

export default router;
