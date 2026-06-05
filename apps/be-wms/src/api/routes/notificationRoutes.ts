import { Router, type Router as ExpressRouter } from "express";
import {
  getNotificationDispatchesHandler,
  sendEmailNotificationHandler,
  sendInAppNotificationHandler,
} from "../controllers/notificationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

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
