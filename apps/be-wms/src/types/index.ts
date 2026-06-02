/**
 * WMS Database Schema — ISO 9001:2015
 * Warehouse Management System · Quản lý kho hàng, tài sản doanh nghiệp
 *
 * ✓ No Hard Deletes  ✓ Audit Trail  ✓ RBAC + SOD
 * ✓ ATP Stock Logic   ✓ Transactional Integrity  ✓ Action/Sync Time
 *
 * Generated from wms_database_schema.html — 28 tables, 14 domains
 */

// ============================================================
// ENUMS
// ============================================================

/** Warehouse type classification */
export enum WarehouseType {
  MAIN = "MAIN",
  STORE = "STORE",
  OFFICE = "OFFICE",
}

/** Generic active/inactive status */
export enum ActiveStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

/** Location type within a warehouse */
export enum LocationType {
  COUNTER = "COUNTER",
  SHELF = "SHELF",
  ZONE = "ZONE",
}

/** Location operational status */
export enum LocationStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  QUARANTINE = "QUARANTINE",
}

/** Product category / product type classification */
export enum ProductType {
  EQUIPMENT = "EQUIPMENT",
  CONSUMABLE = "CONSUMABLE",
  SOUVENIR_SALE = "SOUVENIR_SALE",
  SOUVENIR_GIFT = "SOUVENIR_GIFT",
}

export enum ProductOrigin {
  DOMESTIC = "DOMESTIC",
  INTERNATIONAL = "INTERNATIONAL",
}

/** User account status */
export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
}

/** Role names (RBAC) */
export enum RoleName {
  WAREHOUSE_STAFF = "WAREHOUSE_STAFF",
  WAREHOUSE_MANAGER = "WAREHOUSE_MANAGER",
  STORE_MANAGER = "STORE_MANAGER",
  DIRECTOR = "DIRECTOR",
  ADMIN = "ADMIN",
}

/** Import voucher status flow */
export enum ImportVoucherStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  RECEIVING = "RECEIVING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

/** Condition of received items */
export enum ItemCondition {
  GOOD = "GOOD",
  DAMAGED = "DAMAGED",
  MISSING = "MISSING",
}

/** Export voucher type */
export enum ExportType {
  SALE_POS = "SALE_POS",
  GIFT_MANUAL = "GIFT_MANUAL",
  TRANSFER = "TRANSFER",
  ADJUSTMENT = "ADJUSTMENT",
  INTERNAL = "INTERNAL",
}

/** Export voucher status flow */
export enum ExportVoucherStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

/** Export voucher reference type (polymorphic FK) */
export enum ExportReferenceType {
  POS_TRANSACTION = "POS_TRANSACTION",
  TRANSFER_ORDER = "TRANSFER_ORDER",
  GIFT_SESSION = "GIFT_SESSION",
}

/** Transfer order status flow */
export enum TransferOrderStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  IN_TRANSIT = "IN_TRANSIT",
  RECEIVED = "RECEIVED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

/** Transfer order item status */
export enum TransferItemStatus {
  PENDING = "PENDING",
  IN_TRANSIT = "IN_TRANSIT",
  RECEIVED = "RECEIVED",
  DISCREPANCY = "DISCREPANCY",
}

/** Purchase order status flow */
export enum PurchaseOrderStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  ORDERED = "ORDERED",
  RECEIVING = "RECEIVING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

/** Gift export session status */
export enum GiftSessionStatus {
  OPEN = "OPEN",
  SUBMITTED = "SUBMITTED",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

/** POS transaction type */
export enum PosTransactionType {
  SALE = "SALE",
  REFUND = "REFUND",
}

/** POS transaction status */
export enum PosTransactionStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  REFUNDED = "REFUNDED",
  CANCELLED = "CANCELLED",
}

/** Stock count type */
export enum StockCountType {
  RANDOM = "RANDOM",
  SCHEDULED = "SCHEDULED",
  FULL = "FULL",
}

/** Stock count session status */
export enum StockCountSessionStatus {
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  DISCREPANCY_FOUND = "DISCREPANCY_FOUND",
  RESOLVED = "RESOLVED",
}

/** Stock count item condition */
export enum StockCountItemCondition {
  GOOD = "GOOD",
  DAMAGED = "DAMAGED",
  EXPIRED = "EXPIRED",
  MISSING = "MISSING",
}

/** Source type for non-conformity reports */
export enum NonconformitySourceType {
  IMPORT = "IMPORT",
  STOCK_COUNT = "STOCK_COUNT",
  TRANSFER = "TRANSFER",
  EXPORT = "EXPORT",
  MANUAL = "MANUAL",
}

/** Issue type classification */
export enum IssueType {
  DAMAGED = "DAMAGED",
  DISCREPANCY = "DISCREPANCY",
  EXPIRED = "EXPIRED",
  MISSING = "MISSING",
  SEAL_BROKEN = "SEAL_BROKEN",
}

/** Non-conformity report status */
export enum NonconformityStatus {
  OPEN = "OPEN",
  QUARANTINED = "QUARANTINED",
  UNDER_REVIEW = "UNDER_REVIEW",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
}

/** Resolution type for non-conformity */
export enum ResolutionType {
  RETURN = "RETURN",
  DESTROY = "DESTROY",
  ADJUST = "ADJUST",
  REUSE = "REUSE",
}

/** Quarantine record status */
export enum QuarantineStatus {
  QUARANTINED = "QUARANTINED",
  RELEASED = "RELEASED",
  DISPOSED = "DISPOSED",
}

/** Adjustment type */
export enum AdjustmentType {
  INCREASE = "INCREASE",
  DECREASE = "DECREASE",
}

/** Adjustment reference type */
export enum AdjustmentReferenceType {
  NONCONFORMITY = "NONCONFORMITY",
  STOCK_COUNT = "STOCK_COUNT",
  SYSTEM_ERROR = "SYSTEM_ERROR",
  OTHER = "OTHER",
}

/** Adjustment voucher status */
export enum AdjustmentVoucherStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

/** Approval workflow entity type (polymorphic) */
export enum ApprovalEntityType {
  IMPORT_VOUCHER = "IMPORT_VOUCHER",
  EXPORT_VOUCHER = "EXPORT_VOUCHER",
  TRANSFER_ORDER = "TRANSFER_ORDER",
  PURCHASE_ORDER = "PURCHASE_ORDER",
  ADJUSTMENT_VOUCHER = "ADJUSTMENT_VOUCHER",
  GIFT_SESSION = "GIFT_SESSION",
}

/** Approval workflow step status */
export enum ApprovalStatus {
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

/** Approval method */
export enum ApprovalMethod {
  STANDARD = "STANDARD",
  REAUTH_REQUIRED = "REAUTH_REQUIRED",
}

/** Audit log action types */
export enum AuditAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  APPROVE = "APPROVE",
  REJECT = "REJECT",
  CANCEL = "CANCEL",
  SOFT_DELETE = "SOFT_DELETE",
  QUARANTINE = "QUARANTINE",
  RELEASE = "RELEASE",
  TRANSFER = "TRANSFER",
}

/** Attachment file type */
export enum FileType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  DOCUMENT = "DOCUMENT",
}

// ============================================================
// TABLE TYPES
// ============================================================

// ─────────────────────────────────────────────
// MASTER DATA
// ─────────────────────────────────────────────

export interface Organization {
  id: string; // UUID, PK
  name: string;
  code: string; // UNIQUE
  tax_code: string | null;
  address: string | null;
  is_deleted: boolean; // ISO — soft delete only
  created_at: Date;
  updated_at: Date;
}

export interface Warehouse {
  id: string; // UUID, PK
  organization_id: string; // FK → organizations
  name: string;
  code: string; // UNIQUE
  type: WarehouseType;
  address: string | null;
  manager_id: string | null; // FK → users
  status: ActiveStatus;
  warehouse_description: string | null;
  warehouse_image_url: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
  coordinate: {
    longitude: number;
    latitude: number;
  } | null;
}

export interface WarehouseLocation {
  id: string; // UUID, PK
  warehouse_id: string; // FK → warehouses
  name: string;
  code: string;
  warehouse_location_description: string | null;
  warehouse_location_image_url: string | null;
  type: LocationType;
  status: LocationStatus;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ProductCategory {
  id: string; // UUID, PK
  parent_id: string | null; // FK → self (hierarchical)
  name: string;
  code: string; // UNIQUE
  type: ProductType;
  category_description: string | null;
  is_deleted: boolean;
  created_at: Date;
}

export interface Product {
  id: string; // UUID, PK
  category_id: string; // FK → product_categories
  name: string;
  code: string; // UNIQUE (SKU)
  barcode: string | null; // IDX
  product_image_url: string[] | null;
  product_material: string | null;
  product_origin: ProductOrigin | null;
  unit: string; // PCS, BOX, KG, SET…
  product_type: ProductType;
  unit_price: number | null;
  is_serialized: boolean;
  description: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

// ─────────────────────────────────────────────
// USERS & RBAC (ISO 5.3 — Segregation of Duties)
// ─────────────────────────────────────────────

export interface User {
  id: string; // UUID, PK
  username: string; // UNIQUE
  email: string; // UNIQUE
  password_hash: string;
  full_name: string;
  employee_id: string; // UNIQUE
  status: UserStatus;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Role {
  id: string; // UUID, PK
  name: RoleName; // UNIQUE
  description: string | null;
  permissions: Record<string, unknown>; // JSONB
  created_at: Date;
}

/**
 * User ↔ Warehouse ↔ Role mapping.
 * warehouse_id nullable = global scope.
 * A user can have multiple roles across different warehouses.
 */
export interface UserWarehouseRole {
  id: string; // UUID, PK
  user_id: string; // FK → users
  warehouse_id: string | null; // FK → warehouses (nullable = global)
  role_id: string; // FK → roles
  assigned_by: string; // FK → users
  valid_from: string; // DATE
  valid_until: string | null; // DATE, nullable
  is_active: boolean;
  created_at: Date;
}

// ─────────────────────────────────────────────
// INVENTORY — ATP Stock Logic (ISO 8.7)
// ─────────────────────────────────────────────

/**
 * Inventory per location-product pair.
 *
 * ATP formula: total_quantity = atp_quantity + on_hold_quantity
 *              + in_transit_quantity + quarantine_quantity
 *
 * UNIQUE(warehouse_location_id, product_id)
 * All export/transfer operations deduct from atp_quantity only.
 */
export interface Inventory {
  id: string; // UUID, PK
  warehouse_id: string; // FK → warehouses (denormalized)
  warehouse_location_id: string; // FK → warehouse_locations
  product_id: string; // FK → products
  total_quantity: number; // ATP
  atp_quantity: number; // Available To Promise
  on_hold_quantity: number;
  in_transit_quantity: number;
  quarantine_quantity: number;
  last_count_at: Date | null;
  last_updated_at: Date;
  is_deleted?: boolean;
}

// ─────────────────────────────────────────────
// IMPORT VOUCHERS (ISO 8.5.2)
// ─────────────────────────────────────────────

export interface ImportVoucher {
  id: string; // UUID, PK
  voucher_number: string; // UNIQUE — format: IMP-{YYYYMMDD}-{SEQ}
  warehouse_id: string; // FK → warehouses
  supplier_name: string;
  purchase_order_id: string | null; // FK → purchase_orders
  status: ImportVoucherStatus;
  creator_id: string; // FK → users
  approver_id: string | null; // FK → users — CHECK(creator_id <> approver_id)
  approved_at: Date | null;
  action_time: Date; // ISO — client offline time
  sync_time: Date; // ISO — server receive time
  notes: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ImportVoucherItem {
  id: string; // UUID, PK
  import_voucher_id: string; // FK → import_vouchers
  product_id: string; // FK → products
  warehouse_location_id: string; // FK → warehouse_locations
  expected_quantity: number;
  actual_quantity: number;
  unit_price: number; // DECIMAL
  condition: ItemCondition;
  notes: string | null;
  is_deleted: boolean;
}

// ─────────────────────────────────────────────
// EXPORT VOUCHERS
// ─────────────────────────────────────────────

export interface ExportVoucher {
  id: string; // UUID, PK
  voucher_number: string; // UNIQUE — format: EXP-{YYYYMMDD}-{SEQ}
  warehouse_id: string; // FK → warehouses
  export_type: ExportType;
  status: ExportVoucherStatus;
  creator_id: string; // FK → users
  approver_id: string | null; // FK → users
  approved_at: Date | null;
  reference_id: string | null; // Polymorphic FK
  reference_type: ExportReferenceType | null;
  action_time: Date; // ISO
  sync_time: Date; // ISO
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface ExportVoucherItem {
  id: string; // UUID, PK
  export_voucher_id: string; // FK → export_vouchers
  product_id: string; // FK → products
  warehouse_location_id: string; // FK → warehouse_locations
  quantity: number;
  unit_price: number; // DECIMAL
  notes: string | null;
  is_deleted: boolean;
}

// ─────────────────────────────────────────────
// TRANSFER ORDERS (ISO 8.5.2 · Transactional)
// ─────────────────────────────────────────────

/**
 * Transfer between warehouses. Must be wrapped in a DB transaction:
 * 1. Decrease atp_quantity at source, increase in_transit_quantity
 * 2. Update transfer_order.status = IN_TRANSIT
 * 3. Create receiving record at destination
 * Failure at any step → ROLLBACK entire transaction.
 */
export interface TransferOrder {
  id: string; // UUID, PK
  order_number: string; // UNIQUE
  source_warehouse_id: string; // FK → warehouses
  destination_warehouse_id: string; // FK → warehouses
  status: TransferOrderStatus;
  creator_id: string; // FK → users
  approver_id: string | null; // FK → users
  approved_at: Date | null;
  dispatched_at: Date | null;
  received_at: Date | null;
  requires_reauth: boolean; // ISO — high-value transfer
  reauth_confirmed_by: string | null; // FK → users
  reauth_confirmed_at: Date | null;
  action_time: Date; // ISO
  sync_time: Date; // ISO
  notes: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TransferOrderItem {
  id: string; // UUID, PK
  transfer_order_id: string; // FK → transfer_orders
  product_id: string; // FK → products
  source_location_id: string; // FK → warehouse_locations
  destination_location_id: string | null; // FK → warehouse_locations
  quantity: number;
  received_quantity: number | null;
  status: TransferItemStatus;
  is_deleted: boolean;
}

// ─────────────────────────────────────────────
// PURCHASE ORDERS (ISO 8.4)
// ─────────────────────────────────────────────

export interface PurchaseOrder {
  id: string; // UUID, PK
  order_number: string; // UNIQUE
  warehouse_id: string; // FK → warehouses
  supplier_name: string;
  status: PurchaseOrderStatus;
  creator_id: string; // FK → users
  approver_id: string | null; // FK → users
  approved_at: Date | null;
  total_amount: number; // DECIMAL
  action_time: Date; // ISO
  sync_time: Date; // ISO
  notes: string | null;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface PurchaseOrderItem {
  id: string; // UUID, PK
  purchase_order_id: string; // FK → purchase_orders
  product_id: string; // FK → products
  quantity: number;
  unit_price: number; // DECIMAL
  received_quantity: number;
  is_deleted: boolean;
}

// ─────────────────────────────────────────────
// GIFT EXPORT QUEUE — Xuất quà tặng theo ca
// ─────────────────────────────────────────────

/**
 * Gift export session workflow:
 * Employee scans barcode → items into queue (offline, scanned_at)
 * → End of shift sync to server (synced_at)
 * → Store manager approves session
 * → Trigger auto-creates export_voucher → deducts inventory.atp_quantity
 *
 * SOD: employee_id ≠ approver_id
 */
export interface GiftExportSession {
  id: string; // UUID, PK
  employee_id: string; // FK → users
  warehouse_id: string; // FK → warehouses
  warehouse_location_id: string; // FK → warehouse_locations
  shift_date: string; // DATE
  start_time: Date;
  end_time: Date | null;
  status: GiftSessionStatus;
  approver_id: string | null; // FK → users
  approved_at: Date | null;
  total_items_scanned: number;
  device_id: string | null;
  action_time: Date; // ISO
  sync_time: Date; // ISO
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface GiftExportQueueItem {
  id: string; // UUID, PK
  session_id: string; // FK → gift_export_sessions
  product_id: string; // FK → products
  quantity: number;
  scanned_at: Date; // action_time — offline scan timestamp
  synced_at: Date; // sync_time — server receive timestamp
  customer_note: string | null;
  is_deleted: boolean;
}

// ─────────────────────────────────────────────
// POS INTEGRATION
// ─────────────────────────────────────────────

/**
 * When pos_transactions.status = COMPLETED,
 * trigger auto-creates export_voucher (type=SALE_POS)
 * and deducts inventory.atp_quantity in the same transaction.
 */
export interface PosTransaction {
  id: string; // UUID, PK
  external_order_id: string; // IDX — from POS system
  warehouse_id: string; // FK → warehouses
  warehouse_location_id: string; // FK → warehouse_locations
  cashier_id: string; // FK → users
  transaction_type: PosTransactionType;
  status: PosTransactionStatus;
  total_amount: number; // DECIMAL
  transaction_at: Date;
  sync_time: Date; // ISO
  export_voucher_id: string | null; // FK → export_vouchers
  is_deleted: boolean;
  created_at: Date;
}

export interface PosTransactionItem {
  id: string; // UUID, PK
  transaction_id: string; // FK → pos_transactions
  product_id: string; // FK → products
  quantity: number;
  unit_price: number; // DECIMAL
  total_price: number; // DECIMAL
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
  count_type: StockCountType;
  status: StockCountSessionStatus;
  counter_id: string; // FK → users
  supervisor_id: string; // FK → users — CHECK(counter_id <> supervisor_id)
  started_at: Date;
  completed_at: Date | null;
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
  product_id: string; // FK → products
  warehouse_location_id: string; // FK → warehouse_locations
  system_quantity: number;
  atp_snapshot: number;
  counted_quantity: number;
  discrepancy: number; // = counted_quantity - system_quantity
  condition: StockCountItemCondition;
  has_discrepancy: boolean; // IDX
  notes: string | null;
  is_deleted: boolean;
}

// ─────────────────────────────────────────────
// NON-CONFORMITY CONTROL (ISO 8.7)
// ─────────────────────────────────────────────

/**
 * When issue_type = DAMAGED | SEAL_BROKEN:
 * - Auto: inventory.quarantine_quantity += quantity_affected
 * - Auto: inventory.atp_quantity -= quantity_affected
 *
 * When requires_evidence = true:
 * - API requires at least 1 attachment (file_type = IMAGE) before submit.
 */
export interface NonconformityReport {
  id: string; // UUID, PK
  report_number: string; // UNIQUE
  source_type: NonconformitySourceType;
  source_id: string | null; // Polymorphic FK
  warehouse_id: string; // FK → warehouses
  warehouse_location_id: string; // FK → warehouse_locations
  product_id: string; // FK → products
  quantity_affected: number;
  issue_type: IssueType;
  status: NonconformityStatus;
  reporter_id: string; // FK → users
  reviewer_id: string | null; // FK → users
  resolved_by: string | null; // FK → users
  resolution_type: ResolutionType | null;
  resolution_notes: string | null;
  requires_evidence: boolean; // ISO
  action_time: Date; // ISO
  sync_time: Date; // ISO
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface QuarantineRecord {
  id: string; // UUID, PK
  nonconformity_report_id: string; // FK → nonconformity_reports
  product_id: string; // FK → products
  warehouse_location_id: string; // FK → warehouse_locations
  quantity: number;
  quarantine_reason: string;
  quarantined_at: Date;
  released_at: Date | null;
  released_by: string | null; // FK → users
  release_notes: string | null;
  status: QuarantineStatus;
  is_deleted: boolean;
}

export interface AdjustmentVoucher {
  id: string; // UUID, PK
  voucher_number: string; // UNIQUE
  warehouse_id: string; // FK → warehouses
  warehouse_location_id: string; // FK → warehouse_locations
  product_id: string; // FK → products
  adjustment_type: AdjustmentType;
  quantity_before: number; // ISO — snapshot before adjustment
  quantity_after: number; // ISO — snapshot after adjustment
  adjustment_quantity: number;
  reason: string;
  reference_type: AdjustmentReferenceType;
  reference_id: string | null; // Polymorphic FK
  creator_id: string; // FK → users
  approver_id: string | null; // FK → users — CHECK(creator_id <> approver_id)
  status: AdjustmentVoucherStatus;
  action_time: Date; // ISO
  sync_time: Date; // ISO
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

// ─────────────────────────────────────────────
// APPROVAL WORKFLOWS (ISO 5.3 · SOD)
// ─────────────────────────────────────────────

/**
 * Centralized approval workflow.
 * CHECK(creator_id <> approver_id) — enforced at DB level.
 *
 * When approval_method = REAUTH_REQUIRED (high-value transfers),
 * API requires re-authentication (password/PIN) before recording
 * reauth_confirmed_at. Missing this field → API rejects approval.
 */
export interface ApprovalWorkflow {
  id: string; // UUID, PK
  entity_type: ApprovalEntityType;
  entity_id: string; // Polymorphic FK
  step_number: number;
  status: ApprovalStatus;
  creator_id: string; // FK → users
  assigned_to: string; // FK → users
  approver_id: string | null; // FK → users
  approval_method: ApprovalMethod;
  reauth_confirmed_at: Date | null; // ISO
  comments: string | null;
  action_time: Date; // ISO
  sync_time: Date; // ISO
  created_at: Date;
  updated_at: Date;
}

// ─────────────────────────────────────────────
// AUDIT LOGS & ATTACHMENTS (ISO 8.5.2 · 8.7)
// ─────────────────────────────────────────────

/**
 * IMMUTABLE table — INSERT only, no UPDATE, no DELETE.
 * Revoke UPDATE/DELETE privileges on the DB user.
 *
 * action_time = timestamp when warehouse staff performed the action (even offline).
 * sync_time = timestamp when server received and recorded the entry.
 * old_value / new_value = JSONB full record snapshots.
 */
export interface AuditLog {
  id: string; // UUID, PK
  entity_type: string; // IDX
  entity_id: string; // IDX
  warehouse_id?: string | null; // Optional warehouse scope for warehouse-related events
  action: AuditAction;
  user_id: string; // FK → users
  user_name?: string | null; // Denormalized display name for read models
  action_time: Date; // ISO — offline time
  sync_time: Date; // ISO — server time
  old_value: Record<string, unknown> | null; // JSONB
  new_value: Record<string, unknown> | null; // JSONB
  ip_address: string | null;
  device_id: string | null;
  session_token: string | null;
  notes: string | null;
}

export interface Attachment {
  id: string; // UUID, PK
  entity_type: string; // Polymorphic — table name
  entity_id: string; // IDX — FK to entity
  file_name: string;
  file_url: string;
  file_type: FileType;
  file_size: number; // BIGINT — bytes
  uploaded_by: string; // FK → users
  is_required_evidence: boolean; // ISO
  action_time: Date; // ISO
  sync_time: Date; // ISO
  created_at: Date;
}

// ============================================================
// UTILITY TYPES
// ============================================================

/** Common soft-delete + timestamp fields shared by most tables */
export interface SoftDeletable {
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Common ISO audit time fields (action_time + sync_time) */
export interface ISOTimestamped {
  action_time: Date; // Client-side timestamp (offline)
  sync_time: Date; // Server-side timestamp
}

/** Common approval fields */
export interface Approvable {
  creator_id: string; // FK → users
  approver_id: string | null; // FK → users — CHECK(creator_id <> approver_id)
  approved_at: Date | null;
}

/** Table names for reference */
export type TableName =
  | "organizations"
  | "warehouses"
  | "warehouse_locations"
  | "product_categories"
  | "products"
  | "users"
  | "roles"
  | "user_warehouse_roles"
  | "inventory"
  | "import_vouchers"
  | "import_voucher_items"
  | "export_vouchers"
  | "export_voucher_items"
  | "transfer_orders"
  | "transfer_order_items"
  | "purchase_orders"
  | "purchase_order_items"
  | "gift_export_sessions"
  | "gift_export_queue_items"
  | "pos_transactions"
  | "pos_transaction_items"
  | "stock_count_sessions"
  | "stock_count_items"
  | "nonconformity_reports"
  | "quarantine_records"
  | "adjustment_vouchers"
  | "approval_workflows"
  | "audit_logs"
  | "attachments";
