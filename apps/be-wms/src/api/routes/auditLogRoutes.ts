import { Router, type Router as ExpressRouter } from "express";
import {
  getAuditLogsHandler,
  logExportActionHandler,
} from "../controllers/auditLogController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", requireAnyScopedPermission("audit.read"), getAuditLogsHandler);
router.post(
  "/export",
  requireAnyScopedPermission("audit.read"),
  logExportActionHandler,
);

export default router;
