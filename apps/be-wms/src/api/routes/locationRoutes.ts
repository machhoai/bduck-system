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
  requirePermission("locations.read", (req) =>
    typeof req.query.warehouse_id === "string" ? req.query.warehouse_id : null,
  ),
  getLocationsHandler,
);
router.get(
  "/:id",
  requirePermission("locations.read"),
  getLocationByIdHandler,
);
router.post("/", requirePermission("locations.write"), createLocationHandler);
router.put(
  "/:id",
  requirePermission("locations.write"),
  updateLocationHandler,
);
router.delete(
  "/:id",
  requirePermission("locations.write"),
  deleteLocationHandler,
);

export default router;
