/**
 * Export Voucher Routes
 *
 * All routes require JWT authentication (authMiddleware).
 * Mounted at /api/export-vouchers
 */

import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  createHandler,
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
router.post("/", createHandler);
router.get("/", getActiveHandler);
router.get("/completed", getCompletedHandler);
router.get("/:id", getByIdHandler);

// ── Picking session ──
router.put("/:id/picking-actuals", savePickingHandler);
router.post("/:id/complete-picking", completePickingHandler);

// ── Finalize ──
router.post("/:id/complete-export", completeExportHandler);

export default router;
