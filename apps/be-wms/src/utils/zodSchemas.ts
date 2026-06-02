import { z } from "zod";
import { UserStatus } from "@bduck/shared-types";

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

const userIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine(
    (value) =>
      !value.includes("$") && !value.includes("{") && !value.includes("}"),
    { message: "User ID contains forbidden characters" },
  );

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
  unit_price: z.number().int().min(0).nullable().optional(),
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
  manager_id: userIdSchema.nullable().optional(),
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

// Roles
export const roleBoardPositionSchema = z
  .object({
    x: z.coerce.number(),
    y: z.coerce.number(),
  })
  .nullable()
  .optional();

export const permissionsSchema = z.record(z.string().min(1), z.boolean());

export const createRoleSchema = z.object({
  name: z.string().trim().min(1, { message: "Tên role không được để trống" }),
  description: z.string().trim().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, { message: "Màu role phải là mã hex #RRGGBB" }),
  parent_id: z.string().uuid().nullable().optional(),
  permissions: permissionsSchema.default({}),
  board_position: roleBoardPositionSchema,
});

export const updateRoleSchema = createRoleSchema.partial();

const userRoleAssignmentSchema = z.object({
  warehouse_id: z.string().uuid().nullable(),
  role_id: z.string().uuid(),
  valid_from: z.string().date(),
  valid_until: z.string().date().nullable().optional(),
  is_active: z.boolean().default(true),
});

export const createUserSchema = z.object({
  username: z.string().trim().min(3).max(80),
  email: z.string().trim().email().max(160),
  password: z.string().min(8).max(128),
  full_name: z.string().trim().min(1).max(160),
  employee_id: z.string().trim().min(1).max(80),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
  assignments: z.array(userRoleAssignmentSchema).default([]),
});

export const updateUserSchema = createUserSchema
  .omit({ password: true })
  .partial()
  .extend({
    password: z.string().min(8).max(128).optional(),
    assignments: z.array(userRoleAssignmentSchema).optional(),
  });

// Audit logs
export const auditLogQuerySchema = z.object({
  entity_type: z.string().trim().min(1).optional(),
  entity_id: z.string().trim().min(1).optional(),
  warehouse_id: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1).optional(),
  user_id: z.string().trim().min(1).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(200),
  sort_by: z.enum(["action_time", "sync_time"]).default("sync_time"),
  sort_dir: z.enum(["asc", "desc"]).default("desc"),
});

// ============================================================
// INVENTORY SCHEMAS (Phase 2)
// ============================================================

export const createInventorySchema = z.object({
  warehouse_id: z.string().uuid(),
  warehouse_location_id: z.string().uuid(),
  product_id: z.string().uuid(),
  atp_quantity: z.number().int().min(0, "Số lượng ATP không được âm").default(0),
  on_hold_quantity: z.number().int().min(0).default(0),
  in_transit_quantity: z.number().int().min(0).default(0),
  quarantine_quantity: z.number().int().min(0).default(0),
});

export const updateInventorySchema = z.object({
  atp_quantity: z.number().int().min(0, "Số lượng ATP không được âm").optional(),
  on_hold_quantity: z.number().int().min(0).optional(),
  in_transit_quantity: z.number().int().min(0).optional(),
  quarantine_quantity: z.number().int().min(0).optional(),
});

export const inventoryQuerySchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  warehouse_location_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
});
