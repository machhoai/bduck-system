import { Router, type Router as ExpressRouter } from "express";
import {
  createInventoryHandler,
  deleteInventoryHandler,
  getInventoryByIdHandler,
  getInventoryHandler,
  updateInventoryHandler,
} from "../controllers/inventoryController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/",
  requireAnyScopedPermission("inventory.read"),
  getInventoryHandler,
);
router.get(
  "/:id",
  requireAnyScopedPermission("inventory.read"),
  getInventoryByIdHandler,
);
router.post(
  "/",
  requireAnyScopedPermission("inventory.write"),
  createInventoryHandler,
);
router.put(
  "/:id",
  requireAnyScopedPermission("inventory.write"),
  updateInventoryHandler,
);
router.delete(
  "/:id",
  requireAnyScopedPermission("inventory.write"),
  deleteInventoryHandler,
);

export default router;
