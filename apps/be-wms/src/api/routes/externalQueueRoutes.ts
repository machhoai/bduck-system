import { Router } from "express";
import externalQueueController from "../controllers/externalQueueController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: Router = Router();

// /api/external-queue/cron/auto-submit
router.post(
  "/cron/auto-submit",
  externalQueueController.runScheduledAutoSubmit,
);

// /api/external-queue/pending
router.get(
  "/pending",
  requireAuth,
  requireAnyScopedPermission([
    "external_scan.view",
    "external_scan.approve",
    "external_scan.manage_queue",
  ]),
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

// /api/external-queue/update-quantity
router.patch(
  "/update-quantity",
  requireAuth,
  requireAnyScopedPermission([
    "external_scan.edit_quantity",
    "external_scan.manage_queue",
  ]),
  externalQueueController.updateScanQuantity,
);

// /api/external-queue/cancel-scan
router.post(
  "/cancel-scan",
  requireAuth,
  requireAnyScopedPermission("external_scan.manage_queue"),
  externalQueueController.cancelScan,
);

// /api/external-queue/auto-submit
router.get(
  "/auto-submit-schedule",
  requireAuth,
  requireAnyScopedPermission("external_scan.manage_queue"),
  externalQueueController.getAutoSubmitSchedule,
);

router.put(
  "/auto-submit-schedule",
  requireAuth,
  requireAnyScopedPermission("external_scan.manage_queue"),
  externalQueueController.updateAutoSubmitSchedule,
);

router.post(
  "/auto-submit",
  requireAuth,
  requireAnyScopedPermission("external_scan.manage_queue"),
  externalQueueController.autoSubmitQueuedLocations,
);

// /api/external-queue/scannable-products
router.get(
  "/scannable-products",
  requireAuth,
  requireAnyScopedPermission("external_scan.manage_queue"),
  externalQueueController.getScannableProductsConfig,
);

router.put(
  "/scannable-products",
  requireAuth,
  requireAnyScopedPermission("external_scan.manage_queue"),
  externalQueueController.updateScannableProductsConfig,
);

// /api/external-queue/reject
router.post(
  "/reject",
  requireAuth,
  requireAnyScopedPermission("external_scan.approve"),
  externalQueueController.rejectBatch,
);

export default router;
