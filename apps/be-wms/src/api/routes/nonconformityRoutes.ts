import { Router, type Router as ExpressRouter } from "express";
import {
  getNonconformitiesHandler,
  getNonconformityByIdHandler,
  resolveNonconformityHandler,
} from "../controllers/nonconformityController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  requireAnyScopedPermission,
} from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

router.get(
  "/",
  requireAnyScopedPermission(["inventory.read", "inventory.write"]),
  getNonconformitiesHandler,
);
router.get(
  "/:id",
  requireAnyScopedPermission(["inventory.read", "inventory.write"]),
  getNonconformityByIdHandler,
);
router.post(
  "/:id/resolve",
  requireAnyScopedPermission("inventory.write"),
  resolveNonconformityHandler,
);

export default router;
