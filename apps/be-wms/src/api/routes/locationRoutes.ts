import { Router, type Router as ExpressRouter } from "express";
import {
  createLocationHandler,
  deleteLocationHandler,
  getLocationByIdHandler,
  getLocationsHandler,
  updateLocationHandler,
} from "../controllers/locationController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/",
  requireAnyScopedPermission("locations.read"),
  getLocationsHandler,
);
router.get(
  "/:id",
  requireAnyScopedPermission("locations.read"),
  getLocationByIdHandler,
);
router.post(
  "/",
  requireAnyScopedPermission("locations.write"),
  createLocationHandler,
);
router.put(
  "/:id",
  requireAnyScopedPermission("locations.write"),
  updateLocationHandler,
);
router.delete(
  "/:id",
  requireAnyScopedPermission("locations.write"),
  deleteLocationHandler,
);

export default router;
