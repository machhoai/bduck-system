import { z } from "zod";

// ============================================================
// BASE SCHEMAS
// ============================================================

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  category_id: z.string().uuid().optional(),
});

export const warehouseIdQuerySchema = z.object({
  warehouse_id: z.string().uuid().optional(),
});

// Schema for updating BOM items (Bulk Update)
export const updateProductBomSchema = z.object({
  bom_items: z.array(
    z.object({
      child_product_id: z.string().uuid(),
      quantity: z.number().int().positive("Số lượng phải lớn hơn 0"),
      note: z.string().nullable().optional(),
    }),
  ),
});

export const idParamSchema = z.object({
  id: z.string().uuid({ message: "ID phải là chuỗi UUID hợp lệ" }),
});

// ============================================================
// MASTER DATA SCHEMAS (Phase 1 placeholders)
// ============================================================

// Organizations
export const createOrganizationSchema = z.object({
  name: z.string().min(1, { message: "Tên tổ chức không được để trống" }),
  code: z.string().min(1, { message: "Mã tổ chức không được để trống" }),
  tax_code: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  organization_image_url: z.string().url().nullable().optional(),
});

// Categories
export const createCategorySchema = z.object({
  parent_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1, { message: "Tên danh mục không được để trống" }),
  code: z.string().min(1, { message: "Mã danh mục không được để trống" }),
  type: z.enum(["EQUIPMENT", "CONSUMABLE", "SOUVENIR_SALE", "SOUVENIR_GIFT"]),
  category_description: z.string().nullable().optional(),
});

// Products
export const createProductSchema = z.object({
  category_id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1),
  barcode: z.string().nullable().optional(),
  product_image_url: z.array(z.string().url()).nullable().optional(),
  product_material: z.string().nullable().optional(),
  product_origin: z.enum(["DOMESTIC", "INTERNATIONAL"]).nullable().optional(),
  unit: z.string().min(1),
  product_type: z.enum([
    "EQUIPMENT",
    "CONSUMABLE",
    "SOUVENIR_SALE",
    "SOUVENIR_GIFT",
  ]),
  min_stock_threshold: z.number().int().min(0).nullable().optional(),
  is_serialized: z.boolean(),
  description: z.string().nullable().optional(),
});

// Warehouses
export const createWarehouseSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1),
  type: z.enum(["MAIN", "STORE", "OFFICE"]),
  address: z.string().nullable().optional(),
  manager_id: z.string().uuid().nullable().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional().default("ACTIVE"),
  warehouse_description: z.string().nullable().optional(),
  warehouse_image_url: z.string().url().nullable().optional(),
  coordinate: z
    .object({
      longitude: z.coerce.number().min(-180).max(180),
      latitude: z.coerce.number().min(-90).max(90),
    })
    .nullable()
    .optional(),
});

// Locations
export const createLocationSchema = z.object({
  warehouse_id: z.string().uuid(),
  name: z.string().min(1),
  code: z.string().min(1),
  warehouse_location_description: z.string().nullable().optional(),
  warehouse_location_image_url: z.string().url().nullable().optional(),
  type: z.enum(["COUNTER", "SHELF", "ZONE"]),
  status: z
    .enum(["ACTIVE", "INACTIVE", "QUARANTINE"])
    .optional()
    .default("ACTIVE"),
});
