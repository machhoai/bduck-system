import { Router, type Router as ExpressRouter } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";
import {
  getCategories,
  getCategoryById,
  postCategory,
  putCategory,
  removeCategory,
} from "../controllers/categoryController.js";

const router: ExpressRouter = Router();

// All category routes require authentication
router.use(requireAuth);

// GET /api/categories — List all categories
router.get("/", requireAnyScopedPermission("category.read"), getCategories);

// GET /api/categories/:id — Get single category
router.get(
  "/:id",
  requireAnyScopedPermission("category.read"),
  getCategoryById,
);

// POST /api/categories — Create category
router.post("/", requireAnyScopedPermission("category.create"), postCategory);

// PUT /api/categories/:id — Update category
router.put("/:id", requireAnyScopedPermission("category.update"), putCategory);

// DELETE /api/categories/:id — Soft delete
router.delete(
  "/:id",
  requireAnyScopedPermission("category.delete"),
  removeCategory,
);

export default router;
