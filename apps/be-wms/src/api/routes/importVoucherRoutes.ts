/**
 * Import Voucher Routes
 *
 * All routes require authentication (requireAuth middleware).
 * GET  /             — List vouchers (RBAC-scoped, filtered)
 * GET  /:id          — Voucher detail (items + attachments)
 * GET  /:id/timeline — Audit + workflow timeline
 * POST /             — Create Import Voucher + trigger Workflow Engine
 * PUT  /:id/actuals  — Save Receiving Session actual_quantity data
 */

import { Router, type Router as ExpressRouter } from "express";
import {
  getImportVouchersHandler,
  getImportVoucherByIdHandler,
  getImportVoucherTimelineHandler,
  createImportVoucherHandler,
} from "../controllers/importVoucherController.js";
import { saveActuals } from "../controllers/receivingSessionController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  requirePermission,
  requireAnyScopedPermission,
} from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

// ── READ ──
router.get("/", requireAnyScopedPermission("vouchers.read"), getImportVouchersHandler);
router.get("/:id", requireAnyScopedPermission("vouchers.read"), getImportVoucherByIdHandler);
router.get("/:id/timeline", requireAnyScopedPermission("vouchers.read"), getImportVoucherTimelineHandler);

// ── WRITE ──
router.post(
  "/",
  requirePermission("vouchers.write"),
  createImportVoucherHandler,
);

router.put(
  "/:id/actuals",
  requirePermission("vouchers.write"),
  saveActuals,
);

export default router;

