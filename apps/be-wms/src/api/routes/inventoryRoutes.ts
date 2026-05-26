import { Router, type Router as ExpressRouter } from "express";
import {
  createInventoryHandler,
  deleteInventoryHandler,
  getInventoryByIdHandler,
  getInventoryHandler,
  updateInventoryHandler,
} from "../controllers/inventoryController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", requirePermission("inventory.read"), getInventoryHandler);
router.get("/:id", requirePermission("inventory.read"), getInventoryByIdHandler);
router.post("/", requirePermission("inventory.write"), createInventoryHandler);
router.put("/:id", requirePermission("inventory.write"), updateInventoryHandler);
router.delete(
  "/:id",
  requirePermission("inventory.write"),
  deleteInventoryHandler,
);

export default router;
