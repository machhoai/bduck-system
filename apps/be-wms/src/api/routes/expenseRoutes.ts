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
  closePeriodHandler,
  getDashboardHandler,
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

// CLOSE the accounting period
router.post("/:warehouseId/:period/close", closePeriodHandler);

export default router;

