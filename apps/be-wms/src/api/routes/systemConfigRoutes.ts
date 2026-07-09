import { Router } from "express";
import {
  getOpenApiConfigHandler,
  listOpenApiConfigsHandler,
  testOpenApiConfigHandler,
  upsertOpenApiConfigHandler,
} from "../controllers/systemConfigController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: Router = Router();

router.use(requireAuth);
router.use(requireAnyScopedPermission("system.config"));

router.get("/openapi", listOpenApiConfigsHandler);
router.get("/openapi/:warehouseId", getOpenApiConfigHandler);
router.put("/openapi/:warehouseId", upsertOpenApiConfigHandler);
router.post("/openapi/:warehouseId/test", testOpenApiConfigHandler);

export default router;
