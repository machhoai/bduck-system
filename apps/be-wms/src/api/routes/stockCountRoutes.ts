import { Router, type Router as ExpressRouter } from "express";
import {
  getExternalCountHandler,
  getExternalCountRequirementHandler,
  listExternalCountsHandler,
  updateExternalCountRequirementHandler,
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

router.get(
  "/requirement",
  requireAnyScopedPermission(["external_count.view", "external_count.count"]),
  getExternalCountRequirementHandler,
);

router.put(
  "/requirement",
  requireAnyScopedPermission("external_count.count"),
  updateExternalCountRequirementHandler,
);

router.get(
  "/:id",
  requireAnyScopedPermission(["external_count.view", "external_count.count"]),
  getExternalCountHandler,
);

export default router;
