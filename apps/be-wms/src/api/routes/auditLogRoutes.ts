import { Router, type Router as ExpressRouter } from "express";
import { getAuditLogsHandler } from "../controllers/auditLogController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", requirePermission("audit.read"), getAuditLogsHandler);

export default router;
