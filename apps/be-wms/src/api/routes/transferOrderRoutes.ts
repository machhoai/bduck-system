/**
 * Transfer Order Routes
 *
 * All routes require JWT authentication (authMiddleware).
 * Mounted at /api/transfer-orders
 */

import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  createHandler,
  updateHandler,
  listHandler,
  getDetailHandler,
  createExportHandler,
  receiveHandler,
  completeReceivingHandler,
} from "../controllers/transferOrderController.js";

const router: IRouter = Router();

// ── Auth middleware (LUẬT THÉP) ──
router.use(requireAuth);

// ── CRUD ──
router.post("/", createHandler);
router.get("/", listHandler);
router.get("/:id", getDetailHandler);
router.put("/:id", updateHandler);

// ── Transfer → Export (1-click) ──
router.post("/:id/create-export", createExportHandler);

// ── Receiving ──
router.post("/:id/receive", receiveHandler);
router.post("/:id/complete-receiving", completeReceivingHandler);

export default router;
