import { Router, type Router as ExpressRouter } from "express";
import {
  cancelInternalStockCountHandler,
  createInternalStockCountHandler,
  getInternalStockCountHandler,
  listInternalStockCountsHandler,
  submitInternalStockCountHandler,
  updateInternalStockCountItemHandler,
} from "../controllers/stockCountController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

const STOCK_COUNT_VIEW_PERMISSIONS = [
  "stock_counts.view",
  "stock_counts.create",
  "stock_counts.count",
  "external_count.view",
  "external_count.count",
];
const STOCK_COUNT_CREATE_PERMISSIONS = [
  "stock_counts.create",
  "external_count.count",
];
const STOCK_COUNT_COUNT_PERMISSIONS = [
  "stock_counts.count",
  "external_count.count",
];
const STOCK_COUNT_CANCEL_PERMISSIONS = [
  "stock_counts.cancel",
  "external_count.cancel",
];

router.use(requireAuth);

router.get(
  "/",
  requireAnyScopedPermission(STOCK_COUNT_VIEW_PERMISSIONS),
  listInternalStockCountsHandler,
);

router.post(
  "/",
  requireAnyScopedPermission(STOCK_COUNT_CREATE_PERMISSIONS),
  createInternalStockCountHandler,
);

router.get(
  "/:id",
  requireAnyScopedPermission(STOCK_COUNT_VIEW_PERMISSIONS),
  getInternalStockCountHandler,
);

router.patch(
  "/:id/items/:itemId",
  requireAnyScopedPermission(STOCK_COUNT_COUNT_PERMISSIONS),
  updateInternalStockCountItemHandler,
);

router.post(
  "/:id/submit",
  requireAnyScopedPermission(STOCK_COUNT_COUNT_PERMISSIONS),
  submitInternalStockCountHandler,
);

router.post(
  "/:id/cancel",
  requireAnyScopedPermission(STOCK_COUNT_CANCEL_PERMISSIONS),
  cancelInternalStockCountHandler,
);

export default router;
