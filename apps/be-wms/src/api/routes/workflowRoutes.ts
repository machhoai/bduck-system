/**
 * Workflow Routes — REST endpoints for the Dynamic Workflow Module.
 *
 * All routes require authentication (requireAuth middleware).
 * CRUD operations on definitions require "workflows.manage" permission (ADMIN only).
 * Engine operations (start, complete) require "workflows.execute" permission.
 * Timer callback uses a separate auth mechanism (Cloud Tasks service account).
 */

import { Router, type Router as ExpressRouter } from "express";
import {
  getWorkflowsHandler,
  getWorkflowByIdHandler,
  createWorkflowHandler,
  updateWorkflowHandler,
  archiveWorkflowHandler,
  saveVersionHandler,
  getVersionsHandler,
  publishVersionHandler,
  startWorkflowHandler,
  completeTaskHandler,
  timerCallbackHandler,
} from "../controllers/workflowController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermission, requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

// All routes require authentication
router.use(requireAuth);

// ─────────────────────────────────────────────
// DEFINITION CRUD — ADMIN only (workflows.manage)
// ─────────────────────────────────────────────

router.get("/", requirePermission("workflows.manage"), getWorkflowsHandler);
router.get("/:id", requirePermission("workflows.manage"), getWorkflowByIdHandler);
router.post("/", requirePermission("workflows.manage"), createWorkflowHandler);
router.put("/:id", requirePermission("workflows.manage"), updateWorkflowHandler);
router.delete("/:id", requirePermission("workflows.manage"), archiveWorkflowHandler);

// ─────────────────────────────────────────────
// VERSIONS — ADMIN only (workflows.manage)
// ─────────────────────────────────────────────

router.post("/:id/versions", requirePermission("workflows.manage"), saveVersionHandler);
router.get("/:id/versions", requirePermission("workflows.manage"), getVersionsHandler);
router.post(
  "/:id/versions/:vid/publish",
  requirePermission("workflows.manage"),
  publishVersionHandler,
);

// ─────────────────────────────────────────────
// ENGINE — requires workflows.execute permission
// ─────────────────────────────────────────────

router.post("/engine/start", requireAnyScopedPermission("workflows.execute"), startWorkflowHandler);
router.post("/engine/complete-task", requireAnyScopedPermission("workflows.execute"), completeTaskHandler);

// Timer callback — internal endpoint for Cloud Tasks
// NOTE: In production, this should be protected by a service-to-service auth mechanism
// (e.g., verify the OIDC token from Cloud Tasks) instead of standard JWT auth.
router.post("/engine/timer-callback", timerCallbackHandler);

export default router;
