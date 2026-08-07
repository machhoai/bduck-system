import { Router, type Router as ExpressRouter } from "express";

import {
  activatePosDeviceHandler,
  changePosDeviceStatusHandler,
  createPosEnrollmentHandler,
  getPosStoreOverviewHandler,
  listPosDevicesHandler,
  openPosDeviceSessionHandler,
  transferPosDeviceHandler,
} from "../controllers/posDeviceController.js";
import {
  getPosPaymentSettingsHandler,
  savePosPaymentSettingsHandler,
} from "../controllers/posPaymentSettingsController.js";
import {
  getPosReceiptSettingsHandler,
  savePosReceiptSettingsHandler,
} from "../controllers/posReceiptSettingsController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { authRateLimiter } from "../middlewares/rateLimitMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.post("/devices/activate", authRateLimiter, activatePosDeviceHandler);
router.post("/devices/session", authRateLimiter, openPosDeviceSessionHandler);

router.use(requireAuth);
router.get(
  "/stores/:warehouseId/overview",
  requireAnyScopedPermission("pos.devices.read"),
  getPosStoreOverviewHandler,
);
router.get(
  "/stores/:warehouseId/devices",
  requireAnyScopedPermission("pos.devices.read"),
  listPosDevicesHandler,
);
router.post(
  "/stores/:warehouseId/enrollments",
  requireAnyScopedPermission("pos.devices.manage"),
  createPosEnrollmentHandler,
);
router.patch(
  "/devices/:deviceId/status",
  requireAnyScopedPermission("pos.devices.manage"),
  changePosDeviceStatusHandler,
);
router.patch(
  "/devices/:deviceId/warehouse",
  requireAnyScopedPermission("pos.devices.manage"),
  transferPosDeviceHandler,
);
router.get(
  "/stores/:warehouseId/receipt-settings",
  requireAnyScopedPermission("pos.settings.read"),
  getPosReceiptSettingsHandler,
);
router.put(
  "/stores/:warehouseId/receipt-settings",
  requireAnyScopedPermission("pos.settings.manage"),
  savePosReceiptSettingsHandler,
);
router.get(
  "/stores/:warehouseId/payment-settings",
  requireAnyScopedPermission("pos.settings.read"),
  getPosPaymentSettingsHandler,
);
router.put(
  "/stores/:warehouseId/payment-settings",
  requireAnyScopedPermission("pos.settings.manage"),
  savePosPaymentSettingsHandler,
);

export default router;
