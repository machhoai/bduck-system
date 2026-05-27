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

// ============================================================
// WORKFLOW SCHEMAS (Phase 3 — Dynamic Workflow Engine)
// ============================================================

/** Reusable safe-string: blocks NoSQL injection operators */
const safeString = z.string().trim().min(1).refine(
  (s) => !s.includes("$") && !s.includes("{") && !s.includes("}"),
  { message: "Input contains forbidden characters" },
);

// --- Node config schemas (1 per WorkflowNodeType) ---

const triggerNodeConfigSchema = z.object({
  event: safeString,
});

const approvalNodeConfigSchema = z.object({
  assigned_role_id: z.string().uuid().nullable(),
  assigned_user_id: z.string().uuid().nullable(),
  approval_method: z.enum(["STANDARD", "TWO_FACTOR"]),
  timeout_hours: z.number().positive().nullable(),
  timeout_action: z.enum(["AUTO_APPROVE", "AUTO_REJECT", "ESCALATE"]).nullable(),
});

const systemActionNodeConfigSchema = z.object({
  action_type: safeString,
  params: z.record(z.string(), z.unknown()).optional(),
});

const timerNodeConfigSchema = z.object({
  duration_hours: z.number().int().min(0),
  duration_minutes: z.number().int().min(0).max(59),
});

const conditionNodeConfigSchema = z.object({
  field: safeString,
  operator: z.enum(["EQ", "NEQ", "GT", "GTE", "LT", "LTE", "CONTAINS", "NOT_CONTAINS"]),
  value: z.unknown(),
});

const notificationNodeConfigSchema = z.object({
  channel: z.enum(["IN_APP", "EMAIL", "PUSH"]),
  target_role_id: z.string().uuid().nullable(),
  target_user_id: z.string().uuid().nullable(),
  template_key: safeString,
});

const forkNodeConfigSchema = z.object({});
const joinNodeConfigSchema = z.object({
  join_type: z.enum(["ALL", "ANY"]),
});
const subWorkflowNodeConfigSchema = z.object({
  workflow_definition_id: z.string().uuid(),
});
const webhookNodeConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT"]),
  headers: z.record(z.string(), z.string()).optional(),
  body_template: z.string().nullable(),
  timeout_seconds: z.number().int().min(1).max(120).default(30),
});

/** Union of all node config schemas — validated at runtime based on node.type */
const nodeConfigSchemaMap: Record<string, z.ZodTypeAny> = {
  TRIGGER: triggerNodeConfigSchema,
  APPROVAL: approvalNodeConfigSchema,
  SYSTEM_ACTION: systemActionNodeConfigSchema,
  TIMER: timerNodeConfigSchema,
  CONDITION: conditionNodeConfigSchema,
  NOTIFICATION: notificationNodeConfigSchema,
  FORK: forkNodeConfigSchema,
  JOIN: joinNodeConfigSchema,
  SUB_WORKFLOW: subWorkflowNodeConfigSchema,
  WEBHOOK: webhookNodeConfigSchema,
};

// --- Node & Edge schemas ---

const workflowNodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "TRIGGER", "APPROVAL", "SYSTEM_ACTION", "TIMER",
    "CONDITION", "NOTIFICATION", "FORK", "JOIN",
    "SUB_WORKFLOW", "WEBHOOK",
  ]),
  label: z.string().min(1).max(200),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  config: z.record(z.string(), z.unknown()), // Validated per-type below
});

const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  source_handle: z.string().nullable().default(null),
  label: z.string().nullable().default(null),
});

// --- Top-level schemas ---

export const createWorkflowDefinitionSchema = z.object({
  name: z.string().trim().min(1, "Tên quy trình không được để trống").max(200),
  description: z.string().trim().nullable().optional(),
  entity_type: z.enum([
    "IMPORT_VOUCHER", "EXPORT_VOUCHER",
    "TRANSFER_VOUCHER", "STOCK_COUNT",
  ]),
  scope_warehouse_ids: z.array(z.string().uuid()).nullable().optional(),
});

export const updateWorkflowDefinitionSchema = createWorkflowDefinitionSchema.partial();

/**
 * Schema for saving a workflow version's DAG (nodes + edges).
 * After Zod parses this, the service layer additionally validates:
 * 1. Each node's config against its type-specific schema
 * 2. DAG structural integrity (cycle detection, orphan detection)
 */
export const saveWorkflowVersionSchema = z.object({
  nodes: z.array(workflowNodeSchema).min(1, "DAG phải có ít nhất 1 node"),
  edges: z.array(workflowEdgeSchema),
});

export { nodeConfigSchemaMap };
