import { Router, type Router as ExpressRouter } from "express";
import {
  createWarehouseHandler,
  deleteWarehouseHandler,
  getWarehouseByIdHandler,
  getWarehousesHandler,
  updateWarehouseHandler,
} from "../controllers/warehouseController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", getWarehousesHandler);
router.get(
  "/:id",
  requirePermission("warehouses.read", (req) =>
    typeof req.params.id === "string" ? req.params.id : null,
  ),
  getWarehouseByIdHandler,
);
router.post("/", requirePermission("warehouses.write"), createWarehouseHandler);
router.put(
  "/:id",
  requirePermission("warehouses.write"),
  updateWarehouseHandler,
);
router.delete(
  "/:id",
  requirePermission("warehouses.write"),
  deleteWarehouseHandler,
);

export default router;
