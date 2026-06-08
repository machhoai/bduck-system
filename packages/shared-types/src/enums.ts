// Toàn bộ các enum hệ thống
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

/** Stock policy scope for minimum/maximum stock configuration */
export enum StockPolicyScope {
  WAREHOUSE = "WAREHOUSE",
  LOCATION = "LOCATION",
  SLOT = "SLOT",
}

/** Product category / product type classification */
export enum ProductType {
  EQUIPMENT = "EQUIPMENT",
  // CONSUMABLE = 'CONSUMABLE',
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
  REJECTED = "REJECTED",
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

/** Transfer type classification */
export enum TransferType {
  INTRA_WAREHOUSE = "INTRA_WAREHOUSE",
  INTER_WAREHOUSE = "INTER_WAREHOUSE",
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
  REJECTED = "REJECTED",
  PICKING = "PICKING",
  SHIPPED = "SHIPPED",
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
  EXPORT_PENDING = "EXPORT_PENDING",
  EXPORT_CREATED = "EXPORT_CREATED",
  PICKING = "PICKING",
  IN_TRANSIT = "IN_TRANSIT",
  PENDING_RECEIVE = "PENDING_RECEIVE",
  RECEIVING = "RECEIVING",
  RECEIVED = "RECEIVED",
  COMPLETED = "COMPLETED",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
}

/** Transfer order item status */
export enum TransferItemStatus {
  PENDING = "PENDING",
  IN_TRANSIT = "IN_TRANSIT",
  RECEIVED = "RECEIVED",
  COMPLETED = "COMPLETED",
  DISCREPANCY = "DISCREPANCY",
}

/** Purchase order status flow */
export enum PurchaseOrderStatus {
  DRAFT = "DRAFT",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  PACKING = "PACKING",
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
  EXPORT = "EXPORT",
}

/** Attachment file type */
export enum FileType {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  DOCUMENT = "DOCUMENT",
}

// ============================================================
// EXPENSE MANAGEMENT
// ============================================================

export enum ExpenseStatus {
  OPEN = "OPEN",
  CLOSED = "CLOSED",
}

export enum ExpenseCostCenter {
  OPERATIONS = "OPERATIONS",
  HR = "HR",
  MARKETING = "MARKETING",
  MERCHANDISE = "MERCHANDISE",
  OTHERS = "OTHERS",
}

export enum ExpenseCategory {
  // OPERATIONS
  RENT = "RENT",
  ELECTRICITY = "ELECTRICITY",
  WATER = "WATER",
  TRASH_COLLECTION = "TRASH_COLLECTION",
  DRINKING_WATER = "DRINKING_WATER",
  // HR
  SOCIAL_INSURANCE = "SOCIAL_INSURANCE",
  SALARY_FULLTIME = "SALARY_FULLTIME",
  SALARY_PARTTIME = "SALARY_PARTTIME",
  // MARKETING (quảng cáo, chiến dịch)
  MARKETING = "MARKETING",
  // MERCHANDISE (hàng hóa)
  GIFT_EXPENSE = "GIFT_EXPENSE", // Semi-auto from WMS
  COGS = "COGS", // Cost of Goods Sold - Semi-auto from WMS
  // OTHERS
  CONSUMABLE_SUPPLIES = "CONSUMABLE_SUPPLIES",
  OTHERS = "OTHERS",
}

// ============================================================
// DYNAMIC WORKFLOW ENGINE — @deprecated
// ============================================================
// These enums are DEPRECATED. They belong to the old DAG-based
// workflow engine which has been replaced by the Fixed Pipeline
// pattern (see process.ts). Kept temporarily to avoid breaking
// existing Firestore data. Will be DELETED after full migration.
// ============================================================

/** @deprecated Use Fixed Pipeline pattern instead */
export enum WorkflowDefinitionStatus {
  DRAFT = "DRAFT",
  ACTIVE = "ACTIVE",
  ARCHIVED = "ARCHIVED",
}

/** @deprecated Use Fixed Pipeline pattern instead */
export enum WorkflowNodeType {
  TRIGGER = "TRIGGER",
  APPROVAL = "APPROVAL",
  SYSTEM_ACTION = "SYSTEM_ACTION",
  TIMER = "TIMER",
  CONDITION = "CONDITION",
  NOTIFICATION = "NOTIFICATION",
  FORK = "FORK",
  JOIN = "JOIN",
  SUB_WORKFLOW = "SUB_WORKFLOW",
  WEBHOOK = "WEBHOOK",
  DATA_INPUT = "DATA_INPUT",
}

/** @deprecated Use Fixed Pipeline pattern instead */
export enum WorkflowInstanceStatus {
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  ERROR = "ERROR",
}

/** @deprecated Use Fixed Pipeline pattern instead */
export enum WorkflowTaskStatus {
  PENDING = "PENDING",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  SKIPPED = "SKIPPED",
  FAILED = "FAILED",
  TIMED_OUT = "TIMED_OUT",
}

/** @deprecated Use Fixed Pipeline pattern instead */
export enum ConditionOperator {
  EQ = "EQ",
  NEQ = "NEQ",
  GT = "GT",
  GTE = "GTE",
  LT = "LT",
  LTE = "LTE",
  CONTAINS = "CONTAINS",
  NOT_CONTAINS = "NOT_CONTAINS",
}

/** @deprecated Use Fixed Pipeline pattern instead */
export enum NotificationChannel {
  IN_APP = "IN_APP",
  EMAIL = "EMAIL",
  PUSH = "PUSH",
}

/** @deprecated Use Fixed Pipeline pattern instead */
export enum TimeoutAction {
  AUTO_APPROVE = "AUTO_APPROVE",
  AUTO_REJECT = "AUTO_REJECT",
  ESCALATE = "ESCALATE",
}

/** @deprecated Use Fixed Pipeline pattern instead */
export enum JoinType {
  ALL = "ALL",
  ANY = "ANY",
}

/** @deprecated Use Fixed Pipeline pattern instead */
export enum WebhookMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
}
