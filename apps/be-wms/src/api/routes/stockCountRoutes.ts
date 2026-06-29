import { Router, type Router as ExpressRouter } from "express";
import {
  cancelExternalCountHandler,
  createExternalCountHandler,
  getExternalCountHandler,
  listExternalCountsHandler,
  submitExternalCountHandler,
  updateExternalCountItemHandler,
} from "../controllers/stockCountController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/",
  requireAnyScopedPermission(["external_count.view", "external_count.count"]),
  listExternalCountsHandler,
);

router.post(
  "/",
  requireAnyScopedPermission("external_count.count"),
  createExternalCountHandler,
);

router.get(
  "/:id",
  requireAnyScopedPermission(["external_count.view", "external_count.count"]),
  getExternalCountHandler,
);

router.patch(
  "/:id/items/:itemId",
  requireAnyScopedPermission("external_count.count"),
  updateExternalCountItemHandler,
);

router.post(
  "/:id/submit",
  requireAnyScopedPermission("external_count.count"),
  submitExternalCountHandler,
);

router.post(
  "/:id/cancel",
  requireAnyScopedPermission("external_count.cancel"),
  cancelExternalCountHandler,
);

export default router;

