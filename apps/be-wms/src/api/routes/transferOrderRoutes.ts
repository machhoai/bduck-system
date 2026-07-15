/**
 * Transfer Order Routes
 *
 * All routes require JWT authentication (authMiddleware).
 * Mounted at /api/transfer-orders
 */

import { Router, type IRouter } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";
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
router.post("/", requireAnyScopedPermission("transfers.write"), createHandler);
router.get("/", requireAnyScopedPermission("transfers.read"), listHandler);
router.get(
  "/:id",
  requireAnyScopedPermission("transfers.read"),
  getDetailHandler,
);
router.put(
  "/:id",
  requireAnyScopedPermission("transfers.write"),
  updateHandler,
);

// ── Transfer → Export (1-click) ──
router.post(
  "/:id/create-export",
  requireAnyScopedPermission("transfers.write"),
  createExportHandler,
);

// ── Receiving ──
router.post(
  "/:id/receive",
  requireAnyScopedPermission("transfers.receive"),
  receiveHandler,
);
router.post(
  "/:id/complete-receiving",
  requireAnyScopedPermission("transfers.receive"),
  completeReceivingHandler,
);

export default router;
