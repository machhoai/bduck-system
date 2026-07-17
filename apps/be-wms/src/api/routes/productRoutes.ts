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
import { requireAnyScopedPermission } from "../middlewares/rbacMiddleware.js";

const router: ExpressRouter = Router();

// Lấy danh sách sản phẩm (có hỗ trợ phân trang)
router.get(
  "/",
  requireAuth,
  requireAnyScopedPermission("products.read"),
  getProductsHandler,
);

// Lấy chi tiết sản phẩm
router.get(
  "/:id",
  requireAuth,
  requireAnyScopedPermission("products.read"),
  getProductByIdHandler,
);

// Tạo mới sản phẩm
router.post(
  "/",
  requireAuth,
  requireAnyScopedPermission("products.write"),
  createProductHandler,
);

// Cập nhật sản phẩm
router.put(
  "/:id",
  requireAuth,
  requireAnyScopedPermission("products.write"),
  updateProductHandler,
);

// Xóa mềm sản phẩm
router.delete(
  "/:id",
  requireAuth,
  requireAnyScopedPermission("products.write"),
  deleteProductHandler,
);

// ---------------------------------------------------------------------------
// BOM (Bill of Materials) Routes
// ---------------------------------------------------------------------------

// Lấy danh sách định mức của sản phẩm
router.get(
  "/:id/bom",
  requireAuth,
  requireAnyScopedPermission("products.read"),
  getProductBomHandler,
);

// Cập nhật danh sách định mức (Bulk update)
router.put(
  "/:id/bom",
  requireAuth,
  requireAnyScopedPermission("products.write"),
  updateProductBomHandler,
);

export default router;
