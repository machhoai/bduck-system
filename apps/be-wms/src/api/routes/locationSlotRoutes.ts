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
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", requirePermission("locations.read"), getLocationSlotsHandler);
router.get(
  "/mappings",
  requirePermission("locations.read"),
  getLocationSlotProductsHandler,
);
router.get(
  "/:id",
  requirePermission("locations.read"),
  getLocationSlotByIdHandler,
);
router.post(
  "/",
  requirePermission("locations.write"),
  createLocationSlotHandler,
);
router.put(
  "/:id",
  requirePermission("locations.write"),
  updateLocationSlotHandler,
);
router.delete(
  "/:id",
  requirePermission("locations.write"),
  deleteLocationSlotHandler,
);
router.post(
  "/mappings",
  requirePermission("locations.write"),
  upsertLocationSlotProductHandler,
);
router.delete(
  "/mappings/:id",
  requirePermission("locations.write"),
  deleteLocationSlotProductHandler,
);

export default router;
