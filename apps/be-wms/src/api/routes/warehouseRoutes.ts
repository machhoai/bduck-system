import { Router, type Router as ExpressRouter } from "express";
import {
  createWarehouseHandler,
  deleteWarehouseHandler,
  getWarehouseByIdHandler,
  getWarehousesHandler,
  updateWarehouseHandler,
} from "../controllers/warehouseController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  requireAnyScopedPermission,
  requirePermission,
  requireSystemAdmin,
} from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/",
  requireAnyScopedPermission("warehouses.read"),
  getWarehousesHandler,
);
router.get(
  "/:id",
  requirePermission("warehouses.read", (req) =>
    typeof req.params.id === "string" ? req.params.id : null,
  ),
  getWarehouseByIdHandler,
);
router.post("/", requireSystemAdmin, createWarehouseHandler);
router.put(
  "/:id",
  requireAnyScopedPermission("warehouses.write"),
  updateWarehouseHandler,
);
router.delete(
  "/:id",
  requireAnyScopedPermission("warehouses.write"),
  deleteWarehouseHandler,
);

export default router;
