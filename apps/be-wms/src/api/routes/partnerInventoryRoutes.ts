import { Router, type Router as ExpressRouter } from "express";

import {
  createComparisonHandler,
  createSyncJobHandler,
  getCategoryMappingHandler,
  getPartnerMetadataHandler,
  getSyncJobHandler,
  getWarehouseMappingHandler,
  putCategoryMappingHandler,
  putWarehouseMappingHandler,
  reconcileSyncJobHandler,
} from "../controllers/partnerInventoryController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  requireAnyScopedPermission,
  requirePermission,
} from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();
const warehouseId = (req: { params: Record<string, unknown> }) =>
  typeof req.params.warehouseId === "string" ? req.params.warehouseId : null;

router.use(requireAuth);
router.get(
  "/metadata",
  requireAnyScopedPermission([
    "partner_inventory.read",
    "partner_inventory.mapping.write",
  ]),
  getPartnerMetadataHandler,
);
router.post(
  "/warehouses/:warehouseId/sync-jobs/:requestId/reconcile",
  requirePermission("partner_inventory.sync", warehouseId),
  reconcileSyncJobHandler,
);
router.get(
  "/warehouses/:warehouseId/mapping",
  requirePermission("partner_inventory.mapping.write", warehouseId),
  getWarehouseMappingHandler,
);
router.put(
  "/warehouses/:warehouseId/mapping",
  requirePermission("partner_inventory.mapping.write", warehouseId),
  putWarehouseMappingHandler,
);
router.post(
  "/warehouses/:warehouseId/comparisons",
  requirePermission("partner_inventory.read", warehouseId),
  createComparisonHandler,
);
router.post(
  "/warehouses/:warehouseId/sync-jobs",
  requirePermission("partner_inventory.sync", warehouseId),
  createSyncJobHandler,
);
router.get(
  "/warehouses/:warehouseId/sync-jobs/:requestId",
  requirePermission("partner_inventory.read", warehouseId),
  getSyncJobHandler,
);
router.get(
  "/categories/:categoryId/mapping",
  requireAnyScopedPermission("partner_inventory.mapping.write"),
  getCategoryMappingHandler,
);
router.put(
  "/categories/:categoryId/mapping",
  requireAnyScopedPermission("partner_inventory.mapping.write"),
  putCategoryMappingHandler,
);

export default router;
