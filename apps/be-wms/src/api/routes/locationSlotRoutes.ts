import { Router, type Router as ExpressRouter } from "express";
import {
  createLocationSlotHandler,
  deleteLocationSlotHandler,
  deleteLocationSlotProductHandler,
  getLocationSlotByIdHandler,
  getLocationSlotProductsHandler,
  getLocationSlotsHandler,
  updateLocationSlotHandler,
  upsertLocationSlotProductHandler,
} from "../controllers/locationSlotController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/",
  requireAnyScopedPermission("locations.read"),
  getLocationSlotsHandler,
);
router.get(
  "/mappings",
  requireAnyScopedPermission("locations.read"),
  getLocationSlotProductsHandler,
);
router.get(
  "/:id",
  requireAnyScopedPermission("locations.read"),
  getLocationSlotByIdHandler,
);
router.post(
  "/",
  requireAnyScopedPermission("locations.write"),
  createLocationSlotHandler,
);
router.put(
  "/:id",
  requireAnyScopedPermission("locations.write"),
  updateLocationSlotHandler,
);
router.delete(
  "/:id",
  requireAnyScopedPermission("locations.write"),
  deleteLocationSlotHandler,
);
router.post(
  "/mappings",
  requireAnyScopedPermission("locations.write"),
  upsertLocationSlotProductHandler,
);
router.delete(
  "/mappings/:id",
  requireAnyScopedPermission("locations.write"),
  deleteLocationSlotProductHandler,
);

export default router;
