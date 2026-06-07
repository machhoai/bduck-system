/**
 * Approval Routes
 *
 * All routes require authentication.
 * GET  /pending              — Pending approvals for current user
 * GET  /:entityType/:entityId — Approval timeline
 * POST /:entityType/:entityId/cancel       — Cancel (creator only)
 * POST /:entityType/:entityId/force-cancel — Force cancel (privileged)
 * POST /:id/approve          — Approve
 * POST /:id/reject           — Reject
 */

import { Router, type Router as ExpressRouter } from "express";
import {
  getPendingApprovals,
  getApprovalTimeline,
  approveHandler,
  rejectHandler,
  cancelHandler,
  forceCancelHandler,
} from "../controllers/approvalController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/pending", getPendingApprovals);
router.post("/:entityType/:entityId/cancel", cancelHandler);
router.post("/:entityType/:entityId/force-cancel", forceCancelHandler);
router.get("/:entityType/:entityId", getApprovalTimeline);
router.post("/:id/approve", approveHandler);
router.post("/:id/reject", rejectHandler);

export default router;
