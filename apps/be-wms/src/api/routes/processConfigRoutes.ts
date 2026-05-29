/**
 * Process Config Routes
 *
 * All routes require authentication + workflows.manage permission.
 * GET    /                  — List all configs
 * GET    /:entityType       — Get config for entity type
 * PUT    /:id               — Update config
 * POST   /seed/:entityType  — Seed default config
 */

import { Router, type Router as ExpressRouter } from "express";
import {
  getAllConfigsHandler,
  getConfigHandler,
  updateConfigHandler,
  seedConfigHandler,
  reseedConfigHandler,
} from "../controllers/processConfigController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", requirePermission("workflows.manage"), getAllConfigsHandler);
router.get("/:entityType", requirePermission("workflows.manage"), getConfigHandler);
router.put("/:id", requirePermission("workflows.manage"), updateConfigHandler);
router.post("/seed/:entityType", requirePermission("workflows.manage"), seedConfigHandler);
router.post("/reseed/:entityType", requirePermission("workflows.manage"), reseedConfigHandler);

export default router;
