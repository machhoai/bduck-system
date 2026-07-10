// Tồn kho thực tế và Kiểm kê

import {
  StockCountType,
  StockCountPurpose,
  StockCountSource,
  ExternalCountCheckpointType,
  StockCountSessionStatus,
  StockCountItemCondition,
  StockPolicyScope,
} from "./enums.js";

// ─────────────────────────────────────────────
// INVENTORY — ATP Stock Logic (ISO 8.7)
// ─────────────────────────────────────────────

/**
 * Inventory per location-product pair.
 *
 * Bucket policy:
 * - atp_quantity: good stock, the only bucket counted as Available To Promise.
 * - on_hold_quantity: stock temporarily locked for operational review flows.
 * - in_transit_quantity: stock moving between warehouses.
 * - quarantine_quantity: isolated stock such as damaged/expired goods or receiving surplus.
 *
 * Formula: total_quantity = atp_quantity + on_hold_quantity
 *          + in_transit_quantity + quarantine_quantity
 *
 * UNIQUE(warehouse_location_id, product_id)
 * All export/transfer operations deduct from atp_quantity only.
 * warehouse_id is denormalized from warehouse_locations for direct query.
 */
export interface Inventory {
  id: string; // UUID, PK
  warehouse_id: string; // FK → warehouses (denormalized)
  warehouse_location_id: string; // FK → warehouse_locations
  product_id: string; // FK → products
  total_quantity: number; // Computed: sum of all quantity buckets
  atp_quantity: number; // Available To Promise
  on_hold_quantity: number;
  in_transit_quantity: number;
  quarantine_quantity: number;
  last_count_at: Date | null;
  last_updated_at: Date;
  is_deleted?: boolean;
}

export const INVENTORY_QUANTITY_BUCKET_FIELDS = [
  "atp_quantity",
  "on_hold_quantity",
  "in_transit_quantity",
  "quarantine_quantity",
] as const;

export type InventoryQuantityBucketField =
  (typeof INVENTORY_QUANTITY_BUCKET_FIELDS)[number];

export type InventoryQuantityBuckets = Pick<
  Inventory,
  InventoryQuantityBucketField
>;

export const INVENTORY_ATP_BUCKET_FIELDS = ["atp_quantity"] as const;

export function calculateInventoryTotalQuantity(
  buckets: InventoryQuantityBuckets,
): number {
  return (
    buckets.atp_quantity +
    buckets.on_hold_quantity +
    buckets.in_transit_quantity +
    buckets.quarantine_quantity
  );
}

export function calculateInventoryAtpQuantity(
  buckets: Pick<Inventory, "atp_quantity">,
): number {
  return buckets.atp_quantity;
}

export interface InventoryStockPolicy {
  id: string; // UUID, PK
  scope: StockPolicyScope;
  warehouse_id: string; // FK to warehouses
  warehouse_location_id: string | null; // required for LOCATION and SLOT
  warehouse_location_slot_id: string | null; // required for SLOT
  product_id: string; // FK to products
  min_stock_quantity: number;
  max_stock_quantity: number | null;
  reorder_point_quantity: number | null;
  reorder_quantity: number | null;
  is_active: boolean;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

// ─────────────────────────────────────────────
// STOCK COUNT SESSIONS (ISO 8.5.1)
// ─────────────────────────────────────────────

/**
 * SOD: counter_id ≠ supervisor_id
 * When has_discrepancy = true or condition ≠ GOOD,
 * system auto-creates nonconformity_report.
 */
export interface StockCountSession {
  id: string; // UUID, PK
  session_number: string; // UNIQUE
  warehouse_id: string; // FK → warehouses
  warehouse_location_id?: string | null;
  count_scope?: "WAREHOUSE" | "LOCATION" | "CATEGORY" | "PRODUCT";
  criteria?: {
    warehouse_location_ids?: string[];
    product_ids?: string[];
    category_id?: string | null;
  } | null;
  count_type: StockCountType;
  count_purpose?: StockCountPurpose;
  checkpoint_type?: ExternalCountCheckpointType;
  source?: StockCountSource;
  status: StockCountSessionStatus;
  created_by?: string | null;
  assigned_counter_ids?: string[];
  counter_id: string | null; // FK → users
  supervisor_id: string | null; // FK → users — CHECK(counter_id <> supervisor_id)
  external_operator_name?: string | null;
  external_operator_id?: string | null;
  external_client_id?: string | null;
  device_id?: string | null;
  business_date?: string | null;
  idempotency_key?: string | null;
  blind_count_enabled?: boolean;
  started_at: Date;
  completed_at: Date | null;
  submitted_at?: Date | null;
  cancelled_at?: Date | null;
  cancelled_by?: string | null;
  cancel_reason?: string | null;
  discrepancy_count?: number;
  action_time: Date; // ISO
  sync_time: Date; // ISO
  notes: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface StockCountItem {
  id: string; // UUID, PK
  session_id: string; // FK → stock_count_sessions
  inventory_id?: string | null;
  product_id: string; // FK → products
  warehouse_location_id: string; // FK → warehouse_locations
  system_quantity: number;
  atp_snapshot: number;
  expected_at_count_time?: number | null;
  current_atp?: number | null;
  counted_quantity: number | null;
  counted_at?: Date | null;
  discrepancy: number; // = counted_quantity - system_quantity
  condition: StockCountItemCondition;
  has_discrepancy: boolean; // IDX
  recount_count?: number;
  last_recount_at?: Date | null;
  discrepancy_reason?: string | null;
  discrepancy_note?: string | null;
  movement_delta_before_count?: number;
  movement_delta_after_count?: number;
  evidence_urls?: string[];
  base_atp?: number | null;
  movement_detected?: boolean;
  notes: string | null;
  is_deleted: boolean;
  created_at?: Date;
  updated_at?: Date;
}
