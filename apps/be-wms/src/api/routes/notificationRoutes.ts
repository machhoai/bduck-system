import { Router, type Router as ExpressRouter } from "express";
import {
  getNotificationDispatchesHandler,
  registerPushTokenHandler,
  sendEmailNotificationHandler,
  sendInAppNotificationHandler,
  unregisterPushTokenHandler,
} from "../controllers/notificationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.post("/push-token", registerPushTokenHandler);
router.delete("/push-token", unregisterPushTokenHandler);

router.get(
  "/dispatches",
  requireAnyScopedPermission("notifications.read"),
  getNotificationDispatchesHandler,
);
router.post(
  "/in-app",
  requireAnyScopedPermission("notifications.send_in_app"),
  sendInAppNotificationHandler,
);
router.post(
  "/email",
  requireAnyScopedPermission("notifications.send_email"),
  sendEmailNotificationHandler,
);

export default router;
