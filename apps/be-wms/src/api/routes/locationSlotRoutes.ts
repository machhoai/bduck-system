import { Router, type Request, type Router as ExpressRouter } from "express";
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

const getWarehouseId = (req: Request) =>
  typeof req.body?.warehouse_id === "string"
    ? req.body.warehouse_id
    : typeof req.query.warehouse_id === "string"
      ? req.query.warehouse_id
      : null;

router.get(
  "/",
  requirePermission("locations.read", getWarehouseId),
  getLocationSlotsHandler,
);
router.get(
  "/mappings",
  requirePermission("locations.read", getWarehouseId),
  getLocationSlotProductsHandler,
);
router.get(
  "/:id",
  requirePermission("locations.read"),
  getLocationSlotByIdHandler,
);
router.post(
  "/",
  requirePermission("locations.write", getWarehouseId),
  createLocationSlotHandler,
);
router.put(
  "/:id",
  requirePermission("locations.write", getWarehouseId),
  updateLocationSlotHandler,
);
router.delete(
  "/:id",
  requirePermission("locations.write", getWarehouseId),
  deleteLocationSlotHandler,
);
router.post(
  "/mappings",
  requirePermission("locations.write", getWarehouseId),
  upsertLocationSlotProductHandler,
);
router.delete(
  "/mappings/:id",
  requirePermission("locations.write", getWarehouseId),
  deleteLocationSlotProductHandler,
);

export default router;
