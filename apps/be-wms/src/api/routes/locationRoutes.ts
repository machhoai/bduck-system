import { Router, type Router as ExpressRouter } from "express";
import {
  createLocationHandler,
  deleteLocationHandler,
  getLocationByIdHandler,
  getLocationsHandler,
  updateLocationHandler,
} from "../controllers/locationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/",
  requirePermission("warehouses.read", (req) =>
    typeof req.query.warehouse_id === "string" ? req.query.warehouse_id : null,
  ),
  getLocationsHandler,
);
router.get("/:id", getLocationByIdHandler);
router.post("/", requirePermission("warehouses.write"), createLocationHandler);
router.put(
  "/:id",
  requirePermission("warehouses.write"),
  updateLocationHandler,
);
router.delete(
  "/:id",
  requirePermission("warehouses.write"),
  deleteLocationHandler,
);

export default router;
