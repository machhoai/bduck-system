import { Router } from "express";
import externalQueueController from "../controllers/externalQueueController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: Router = Router();

// /api/external-queue/pending
router.get(
  "/pending",
  requireAuth,
  requireAnyScopedPermission(["external_scan.view", "external_scan.approve"]),
  externalQueueController.getPendingBatches,
);

// /api/external-queue/history
router.get(
  "/history",
  requireAuth,
  requireAnyScopedPermission(["external_scan.view", "external_scan.approve"]),
  externalQueueController.getHistory,
);

// /api/external-queue/approve
router.post(
  "/approve",
  requireAuth,
  requireAnyScopedPermission("external_scan.approve"),
  externalQueueController.approveBatch,
);

// /api/external-queue/reject
router.post(
  "/reject",
  requireAuth,
  requireAnyScopedPermission("external_scan.approve"),
  externalQueueController.rejectBatch,
);

export default router;
