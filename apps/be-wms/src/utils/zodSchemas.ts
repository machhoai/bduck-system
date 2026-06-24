import { z } from "zod";
import {
  IssueType,
  NonconformitySourceType,
  NonconformityStatus,
  ResolutionType,
  UserStatus,
} from "@bduck/shared-types";

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

export const slotQuerySchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  warehouse_location_id: z.string().uuid().optional(),
});

export const createLocationSlotSchema = z.object({
  warehouse_id: z.string().uuid(),
  warehouse_location_id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  code: z.string().trim().min(1).max(80),
  sort_order: z.number().int().min(0).default(0),
  description: z.string().trim().max(500).nullable().optional(),
  is_active: z.boolean().default(true),
});

export const updateLocationSlotSchema = createLocationSlotSchema.partial();

export const slotProductQuerySchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  warehouse_location_id: z.string().uuid().optional(),
});

export const upsertLocationSlotProductSchema = z.object({
  warehouse_id: z.string().uuid(),
  warehouse_location_id: z.string().uuid(),
  warehouse_location_slot_id: z.string().uuid(),
  product_id: z.string().uuid(),
  display_order: z.number().int().min(0).nullable().optional(),
  is_active: z.boolean().default(true),
});

export const stockPolicyQuerySchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  warehouse_location_id: z.string().uuid().optional(),
  warehouse_location_slot_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  scope: z.enum(["WAREHOUSE", "LOCATION", "SLOT"]).optional(),
});

export const upsertStockPolicySchema = z.object({
  scope: z.enum(["WAREHOUSE", "LOCATION", "SLOT"]),
  warehouse_id: z.string().uuid(),
  warehouse_location_id: z.string().uuid().nullable().optional(),
  warehouse_location_slot_id: z.string().uuid().nullable().optional(),
  product_id: z.string().uuid(),
  min_stock_quantity: z.number().int().min(0),
  max_stock_quantity: z.number().int().min(0).nullable().optional(),
  reorder_point_quantity: z.number().int().min(0).nullable().optional(),
  reorder_quantity: z.number().int().min(0).nullable().optional(),
  is_active: z.boolean().default(true),
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
  password: z.string().min(8).max(128).optional(),
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

const noNoSqlOperators = (value: string) =>
  !/\$(where|ne|gt|gte|lt|lte|regex|or|and)\b/i.test(value);

const notificationTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(5000)
  .refine(noNoSqlOperators, { message: "Text contains forbidden operators" });

const notificationUserIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .refine(noNoSqlOperators, {
    message: "User ID contains forbidden operators",
  });

const notificationUrlSchema = z
  .string()
  .trim()
  .max(500)
  .refine((value) => value.startsWith("/") || /^https?:\/\//i.test(value), {
    message: "URL must be internal path or http(s) URL",
  });

const emailListSchema = z.array(z.string().trim().email().max(254)).max(100);

export const sendInAppNotificationSchema = z.object({
  recipient_user_ids: z.array(notificationUserIdSchema).max(500).default([]),
  recipient_role_ids: z.array(z.string().uuid()).max(50).default([]),
  title: notificationTextSchema.max(180),
  message: notificationTextSchema.max(3000),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  action_url: notificationUrlSchema.nullable().optional(),
});

export const sendEmailNotificationSchema = z.object({
  to: emailListSchema.min(1),
  cc: emailListSchema.default([]),
  bcc: emailListSchema.default([]),
  subject: notificationTextSchema.max(180),
  html_content: z.string().trim().min(1).max(200000),
  text_content: z.string().trim().max(20000).optional(),
});

export const notificationDispatchQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

// ============================================================
// INVENTORY SCHEMAS (Phase 2)
// ============================================================

export const createInventorySchema = z.object({
  warehouse_id: z.string().uuid(),
  warehouse_location_id: z.string().uuid(),
  product_id: z.string().uuid(),
  atp_quantity: z
    .number()
    .int()
    .min(0, "Số lượng ATP không được âm")
    .default(0),
  on_hold_quantity: z.number().int().min(0).default(0),
  in_transit_quantity: z.number().int().min(0).default(0),
  quarantine_quantity: z.number().int().min(0).default(0),
});

export const updateInventorySchema = z.object({
  atp_quantity: z
    .number()
    .int()
    .min(0, "Số lượng ATP không được âm")
    .optional(),
  on_hold_quantity: z.number().int().min(0).optional(),
  in_transit_quantity: z.number().int().min(0).optional(),
  quarantine_quantity: z.number().int().min(0).optional(),
});

export const inventoryQuerySchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  warehouse_location_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
});

// ============================================================
// NONCONFORMITY SCHEMAS
// ============================================================

export const nonconformityQuerySchema = z.object({
  warehouse_id: z.string().uuid().optional(),
  warehouse_location_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  source_type: z.nativeEnum(NonconformitySourceType).optional(),
  issue_type: z.nativeEnum(IssueType).optional(),
  status: z.nativeEnum(NonconformityStatus).optional(),
});

export const resolveNonconformitySchema = z.object({
  resolution_type: z.nativeEnum(ResolutionType),
  resolution_notes: z.string().max(1000).nullable().optional(),
  otp: z.string().trim().length(6).optional(),
  action_time: z.string().datetime().optional(),
});
