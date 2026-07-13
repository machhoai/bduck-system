import { db } from "../config/firebase.js";
import { AuditAction } from "@bduck/shared-types";
import { randomUUID } from "crypto";

interface AuditLogParams {
  entity_type: string;
  entity_id: string;
  warehouse_id?: string | null;
  action: AuditAction;
  user_id: string;
  user_name?: string | null;
  entity_name?: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  action_time?: Date;
  ip_address?: string | null;
  device_id?: string | null;
  session_token?: string | null;
  notes?: string | null;
}

export type AuditMetadata = Pick<
  AuditLogParams,
  "action_time" | "ip_address" | "device_id" | "session_token"
>;

const ENTITY_COLLECTION_MAP: Record<string, string> = {
  products: "products",
  product_categories: "product_categories",
  product_bom: "products",
  inventory: "inventory",
  warehouses: "warehouses",
  warehouse_locations: "warehouse_locations",
  warehouse_location_slots: "warehouse_location_slots",
  warehouse_location_slot_products: "warehouse_location_slot_products",
  organizations: "organizations",
  roles: "roles",
  users: "users",
  employee_profiles: "employee_profiles",
  expenses: "expenses",
  notification_dispatches: "notification_dispatches",
  account_invitations: "account_invitations",
  file_templates: "file_templates",
  attendance_logs: "attendance_logs",
  attendance_late_reports: "attendance_late_reports",
  warehouse_attendance_policies: "warehouse_attendance_policies",
  warehouse_attendance_exemptions: "warehouse_attendance_exemptions",
  workflow_definitions: "workflow_definitions",
  workflow_versions: "workflow_definitions",
  workflow_instances: "workflow_instances",
  workflow_tasks: "workflow_tasks",
  PROCESS_CONFIG: "process_configs",
  IMPORT_VOUCHER: "import_vouchers",
  EXPORT_VOUCHER: "export_vouchers",
  TRANSFER_ORDER: "transfer_orders",
  TRANSFER_INTRA: "transfer_orders",
  EXTERNAL_SCAN: "external_scan_queue",
  EXTERNAL_COUNT_CONFIG: "system_configs",
  OPENAPI_CONFIG: "openapi_warehouse_configs",
  STOCK_COUNT_SESSION: "stock_count_sessions",
  STOCK_COUNT_ITEM: "stock_count_items",
  NONCONFORMITY_REPORT: "nonconformity_reports",
};

const ENTITY_NAME_FIELDS = [
  "name",
  "display_name",
  "code",
  "voucher_number",
  "title",
  "sku",
  "employee_name",
  "batch_id",
  "period",
  "full_name",
  "username",
  "email",
  "employee_id",
  "employee_code",
];

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function valueToRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function extractDisplayName(
  data: Record<string, unknown> | null,
): string | null {
  if (!data) return null;

  for (const field of ENTITY_NAME_FIELDS) {
    const value = data[field];
    const text = cleanString(value);
    if (text) return text;
    if (typeof value === "number") return String(value);
  }

  const warehouseId = cleanString(data.warehouse_id);
  const period = cleanString(data.period);
  if (warehouseId && period) return `${warehouseId} ${period}`;

  return null;
}

function extractWarehouseId(params: AuditLogParams): string | null {
  if (params.warehouse_id !== undefined) {
    return cleanString(params.warehouse_id);
  }

  if (params.entity_type === "warehouses") {
    return cleanString(params.entity_id);
  }

  for (const data of [
    valueToRecord(params.new_value),
    valueToRecord(params.old_value),
  ]) {
    const warehouseId =
      cleanString(data?.warehouse_id) ||
      cleanString(data?.source_warehouse_id) ||
      cleanString(data?.destination_warehouse_id);
    if (warehouseId) return warehouseId;
  }

  return null;
}

async function resolveUserName(params: AuditLogParams): Promise<string | null> {
  const explicitName = cleanString(params.user_name);
  if (explicitName) return explicitName;

  const userId = cleanString(params.user_id);
  if (!userId) return null;
  if (userId === "system") return "System";

  try {
    const snapshot = await db.collection("users").doc(userId).get();
    if (!snapshot.exists) return null;

    const data = snapshot.data() || {};
    return (
      cleanString(data.full_name) ||
      cleanString(data.username) ||
      cleanString(data.email) ||
      null
    );
  } catch (error) {
    console.error("[auditService] Failed to resolve user name:", {
      userId,
      error,
    });
    return null;
  }
}

async function resolveEntityName(
  params: AuditLogParams,
): Promise<string | null> {
  const explicitName = cleanString(params.entity_name);
  if (explicitName) return explicitName;

  const snapshotName =
    extractDisplayName(valueToRecord(params.new_value)) ||
    extractDisplayName(valueToRecord(params.old_value));
  if (snapshotName) return snapshotName;

  const collectionName = ENTITY_COLLECTION_MAP[params.entity_type];
  const entityId = cleanString(params.entity_id);
  if (!collectionName || !entityId || entityId.includes(",")) return null;

  try {
    const snapshot = await db.collection(collectionName).doc(entityId).get();
    if (!snapshot.exists) return null;
    return extractDisplayName(snapshot.data() || {});
  } catch (error) {
    console.error("[auditService] Failed to resolve entity name:", {
      entityType: params.entity_type,
      entityId,
      collectionName,
      error,
    });
    return null;
  }
}

/**
 * Audit Service (ISO 9001 Compliance)
 * IMMUTABLE operations: Only inserts are allowed for audit logs.
 */
export const logAudit = async (params: AuditLogParams) => {
  try {
    const auditRef = db.collection("audit_logs").doc(randomUUID());
    const action_time = params.action_time || new Date();
    const sync_time = new Date(); // Server receive time
    const [userName, entityName] = await Promise.all([
      resolveUserName(params),
      resolveEntityName(params),
    ]);

    await auditRef.set({
      id: auditRef.id,
      entity_type: params.entity_type,
      entity_id: params.entity_id,
      warehouse_id: extractWarehouseId(params),
      action: params.action,
      user_id: params.user_id,
      user_name: userName,
      entity_name: entityName,
      action_time: action_time,
      sync_time: sync_time,
      old_value: params.old_value,
      new_value: params.new_value,
      ip_address: cleanString(params.ip_address),
      device_id: cleanString(params.device_id),
      session_token: cleanString(params.session_token),
      notes: cleanString(params.notes),
    });

    return auditRef.id;
  } catch (error) {
    // We log the error but usually don't want to throw and crash the main transaction
    // However, for high security systems, failing audit log could fail the transaction.
    // Assuming non-blocking audit logging for now, or this could be part of a batch.
    console.error("[auditService] Failed to write audit log:", error);
    throw error;
  }
};
