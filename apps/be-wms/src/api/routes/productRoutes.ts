import { Router, type Router as ExpressRouter } from "express";
import {
  getProductsHandler,
  getProductByIdHandler,
  createProductHandler,
  updateProductHandler,
  deleteProductHandler,
} from "../controllers/productController.js";
import {
  getProductBomHandler,
  updateProductBomHandler,
} from "../controllers/productBomController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";
import { requirePermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

// Lấy danh sách sản phẩm (có hỗ trợ phân trang)
router.get(
  "/",
  requireAuth,
  requirePermission("products.read"),
  getProductsHandler,
);

// Lấy chi tiết sản phẩm
router.get(
  "/:id",
  requireAuth,
  requirePermission("products.read"),
  getProductByIdHandler,
);

// Tạo mới sản phẩm
router.post(
  "/",
  requireAuth,
  requirePermission("products.write"),
  createProductHandler,
);

// Cập nhật sản phẩm
router.put(
  "/:id",
  requireAuth,
  requirePermission("products.write"),
  updateProductHandler,
);

// Xóa mềm sản phẩm
router.delete(
  "/:id",
  requireAuth,
  requirePermission("products.write"),
  deleteProductHandler,
);

// ---------------------------------------------------------------------------
// BOM (Bill of Materials) Routes
// ---------------------------------------------------------------------------

// Lấy danh sách định mức của sản phẩm
router.get(
  "/:id/bom",
  requireAuth,
  requirePermission("products.read"),
  getProductBomHandler,
);

// Cập nhật danh sách định mức (Bulk update)
router.put(
  "/:id/bom",
  requireAuth,
  requirePermission("products.write"),
  updateProductBomHandler,
);

export default router;
