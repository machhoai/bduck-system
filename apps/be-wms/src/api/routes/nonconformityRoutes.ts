import { Router, type Router as ExpressRouter } from "express";
import {
  getNonconformitiesHandler,
  getNonconformityByIdHandler,
  resolveNonconformityHandler,
} from "../controllers/nonconformityController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get("/", requirePermission("inventory.read"), getNonconformitiesHandler);
router.get("/:id", requirePermission("inventory.read"), getNonconformityByIdHandler);
router.post(
  "/:id/resolve",
  requirePermission("inventory.write"),
  resolveNonconformityHandler,
);

export default router;
