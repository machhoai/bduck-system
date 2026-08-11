import { raw, Router, type Router as ExpressRouter } from "express";

import {
  deletePosCustomerDisplayMediaHandler,
  getPosCustomerDisplaySettingsHandler,
  savePosCustomerDisplaySettingsHandler,
  uploadPosCustomerDisplayMediaHandler,
} from "../controllers/posCustomerDisplayAdminController.js";
import {
  deletePosCustomerDisplayMediaFromDeviceHandler,
  getPosCustomerDisplayMediaContentFromDeviceHandler,
  getPosCustomerDisplaySettingsFromDeviceHandler,
  savePosCustomerDisplaySettingsFromDeviceHandler,
  uploadPosCustomerDisplayMediaFromDeviceHandler,
} from "../controllers/posCustomerDisplayDeviceController.js";
import {
  activatePosDeviceHandler,
  changePosDeviceStatusHandler,
  createPosEnrollmentHandler,
  getPosStoreOverviewHandler,
  listPosDevicesHandler,
  openPosDeviceSessionHandler,
  savePosReceiptSettingsFromDeviceHandler,
  transferPosDeviceHandler,
  watchPosCustomerDisplaySettingsHandler,
  watchPosReceiptSettingsHandler,
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
import { apiRateLimiter, authRateLimiter } from "../middlewares/rateLimitMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();
const customerDisplayRawBody = raw({
  type: ["image/png", "image/jpeg", "image/webp", "video/mp4", "application/octet-stream"],
  limit: "20mb",
});

router.post("/devices/activate", authRateLimiter, activatePosDeviceHandler);
router.post("/devices/session", authRateLimiter, openPosDeviceSessionHandler);
router.post(
  "/devices/receipt-settings/watch",
  apiRateLimiter,
  watchPosReceiptSettingsHandler,
);
router.post(
  "/devices/customer-display-settings/watch",
  apiRateLimiter,
  watchPosCustomerDisplaySettingsHandler,
);
router.get(
  "/devices/customer-display-media/:mediaId/content",
  apiRateLimiter,
  getPosCustomerDisplayMediaContentFromDeviceHandler,
);
router.put(
  "/devices/receipt-settings",
  apiRateLimiter,
  savePosReceiptSettingsFromDeviceHandler,
);

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
router.get(
  "/stores/:warehouseId/customer-display-settings",
  requireAnyScopedPermission("pos.advertising.read"),
  getPosCustomerDisplaySettingsHandler,
);
router.put(
  "/stores/:warehouseId/customer-display-settings",
  requireAnyScopedPermission("pos.advertising.manage"),
  savePosCustomerDisplaySettingsHandler,
);
router.post(
  "/stores/:warehouseId/customer-display-media",
  requireAnyScopedPermission("pos.advertising.manage"),
  customerDisplayRawBody,
  uploadPosCustomerDisplayMediaHandler,
);
router.patch(
  "/stores/:warehouseId/customer-display-media/:mediaId",
  requireAnyScopedPermission("pos.advertising.manage"),
  deletePosCustomerDisplayMediaHandler,
);
router.get(
  "/devices/customer-display-settings/editor",
  requireAnyScopedPermission("pos.advertising.read"),
  getPosCustomerDisplaySettingsFromDeviceHandler,
);
router.put(
  "/devices/customer-display-settings",
  requireAnyScopedPermission("pos.advertising.manage"),
  savePosCustomerDisplaySettingsFromDeviceHandler,
);
router.post(
  "/devices/customer-display-media",
  requireAnyScopedPermission("pos.advertising.manage"),
  customerDisplayRawBody,
  uploadPosCustomerDisplayMediaFromDeviceHandler,
);
router.patch(
  "/devices/customer-display-media/:mediaId",
  requireAnyScopedPermission("pos.advertising.manage"),
  deletePosCustomerDisplayMediaFromDeviceHandler,
);
router.put(
  "/stores/:warehouseId/payment-settings",
  requireAnyScopedPermission("pos.settings.manage"),
  savePosPaymentSettingsHandler,
);

export default router;
