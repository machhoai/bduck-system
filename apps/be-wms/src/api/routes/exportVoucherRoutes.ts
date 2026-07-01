/**
 * Export Voucher Routes
 *
 * All routes require JWT authentication (authMiddleware).
 * Mounted at /api/export-vouchers
 */

import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";
import {
  createHandler,
  updateHandler,
  getActiveHandler,
  getCompletedHandler,
  getByIdHandler,
  savePickingHandler,
  completePickingHandler,
  completeExportHandler,
} from "../controllers/exportVoucherController.js";

const router: IRouter = Router();

// ── Auth middleware (LUẬT THÉP) ──
router.use(requireAuth);

// ── CRUD ──
router.post("/", requireAnyScopedPermission("vouchers.write"), createHandler);
router.get("/", requireAnyScopedPermission("vouchers.read"), getActiveHandler);
router.get(
  "/completed",
  requireAnyScopedPermission("vouchers.read"),
  getCompletedHandler,
);
router.get("/:id", requireAnyScopedPermission("vouchers.read"), getByIdHandler);
router.put("/:id", requireAnyScopedPermission("vouchers.write"), updateHandler);

// ── Picking session ──
router.put(
  "/:id/picking-actuals",
  requireAnyScopedPermission("vouchers.write"),
  savePickingHandler,
);
router.post(
  "/:id/complete-picking",
  requireAnyScopedPermission("vouchers.write"),
  completePickingHandler,
);

// ── Finalize ──
router.post(
  "/:id/complete-export",
  requireAnyScopedPermission("vouchers.write"),
  completeExportHandler,
);

export default router;
