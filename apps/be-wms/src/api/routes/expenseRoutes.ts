/**
 * Expense Routes — REST API Mounting
 *
 * All routes are protected by requireAuth middleware.
 * Fine-grained RBAC is handled inside the controller handlers
 * because permission keys depend on the category (dynamic).
 */

import { Router, type Router as ExpressRouter } from "express";
import {
  getExpenseHandler,
  updateItemHandler,
  saveCustomItemHandler,
  deleteCustomItemHandler,
  closePeriodHandler,
  getDashboardHandler,
  reopenPeriodHandler,
} from "../controllers/expenseController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router: ExpressRouter = Router();

router.use(requireAuth);

// DASHBOARD route (must be before /:warehouseId/:period to avoid param conflict)
router.get("/dashboard/:warehouseId/:period", getDashboardHandler);

// GET expense data (single warehouse or consolidated)
router.get("/:warehouseId/:period", getExpenseHandler);

// UPDATE a specific expense item by category
router.put("/:warehouseId/:period/items/:category", updateItemHandler);

// CREATE/UPDATE a custom expense item
router.put("/:warehouseId/:period/custom-items/:itemId", saveCustomItemHandler);

// SOFT DELETE a custom expense item
router.delete("/:warehouseId/:period/custom-items/:itemId", deleteCustomItemHandler);

// CLOSE the accounting period
router.post("/:warehouseId/:period/close", closePeriodHandler);

// REOPEN a previously closed accounting period
router.post("/:warehouseId/:period/reopen", reopenPeriodHandler);

export default router;
