// Toàn bộ các enum hệ thống
// ============================================================
// ENUMS
// ============================================================

/** Warehouse type classification */
export enum WarehouseType {
    MAIN = 'MAIN',
    STORE = 'STORE',
    OFFICE = 'OFFICE',
}

/** Generic active/inactive status */
export enum ActiveStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
}

/** Location type within a warehouse */
export enum LocationType {
    COUNTER = 'COUNTER',
    SHELF = 'SHELF',
    ZONE = 'ZONE',
}

/** Location operational status */
export enum LocationStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    QUARANTINE = 'QUARANTINE',
}

/** Product category / product type classification */
export enum ProductType {
    EQUIPMENT = 'EQUIPMENT',
    CONSUMABLE = 'CONSUMABLE',
    SOUVENIR_SALE = 'SOUVENIR_SALE',
    SOUVENIR_GIFT = 'SOUVENIR_GIFT',
}

export enum ProductOrigin {
    DOMESTIC = 'DOMESTIC',
    INTERNATIONAL = 'INTERNATIONAL',
}

/** User account status */
export enum UserStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    SUSPENDED = 'SUSPENDED',
}

/** Role names (RBAC) */
export enum RoleName {
    WAREHOUSE_STAFF = 'WAREHOUSE_STAFF',
    WAREHOUSE_MANAGER = 'WAREHOUSE_MANAGER',
    STORE_MANAGER = 'STORE_MANAGER',
    DIRECTOR = 'DIRECTOR',
    ADMIN = 'ADMIN',
}

/** Import voucher status flow */
export enum ImportVoucherStatus {
    DRAFT = 'DRAFT',
    PENDING_APPROVAL = 'PENDING_APPROVAL',
    APPROVED = 'APPROVED',
    RECEIVING = 'RECEIVING',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

/** Condition of received items */
export enum ItemCondition {
    GOOD = 'GOOD',
    DAMAGED = 'DAMAGED',
    MISSING = 'MISSING',
}

/** Export voucher type */
export enum ExportType {
    SALE_POS = 'SALE_POS',
    GIFT_MANUAL = 'GIFT_MANUAL',
    TRANSFER = 'TRANSFER',
    ADJUSTMENT = 'ADJUSTMENT',
    INTERNAL = 'INTERNAL',
}

/** Export voucher status flow */
export enum ExportVoucherStatus {
    DRAFT = 'DRAFT',
    PENDING_APPROVAL = 'PENDING_APPROVAL',
    APPROVED = 'APPROVED',
    PROCESSING = 'PROCESSING',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

/** Export voucher reference type (polymorphic FK) */
export enum ExportReferenceType {
    POS_TRANSACTION = 'POS_TRANSACTION',
    TRANSFER_ORDER = 'TRANSFER_ORDER',
    GIFT_SESSION = 'GIFT_SESSION',
}

/** Transfer order status flow */
export enum TransferOrderStatus {
    DRAFT = 'DRAFT',
    PENDING_APPROVAL = 'PENDING_APPROVAL',
    APPROVED = 'APPROVED',
    IN_TRANSIT = 'IN_TRANSIT',
    RECEIVED = 'RECEIVED',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

/** Transfer order item status */
export enum TransferItemStatus {
    PENDING = 'PENDING',
    IN_TRANSIT = 'IN_TRANSIT',
    RECEIVED = 'RECEIVED',
    DISCREPANCY = 'DISCREPANCY',
}

/** Purchase order status flow */
export enum PurchaseOrderStatus {
    DRAFT = 'DRAFT',
    PENDING_APPROVAL = 'PENDING_APPROVAL',
    APPROVED = 'APPROVED',
    ORDERED = 'ORDERED',
    RECEIVING = 'RECEIVING',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED',
}

/** Gift export session status */
export enum GiftSessionStatus {
    OPEN = 'OPEN',
    SUBMITTED = 'SUBMITTED',
    PENDING_APPROVAL = 'PENDING_APPROVAL',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

/** POS transaction type */
export enum PosTransactionType {
    SALE = 'SALE',
    REFUND = 'REFUND',
}

/** POS transaction status */
export enum PosTransactionStatus {
    PENDING = 'PENDING',
    COMPLETED = 'COMPLETED',
    REFUNDED = 'REFUNDED',
    CANCELLED = 'CANCELLED',
}

/** Stock count type */
export enum StockCountType {
    RANDOM = 'RANDOM',
    SCHEDULED = 'SCHEDULED',
    FULL = 'FULL',
}

/** Stock count session status */
export enum StockCountSessionStatus {
    IN_PROGRESS = 'IN_PROGRESS',
    COMPLETED = 'COMPLETED',
    DISCREPANCY_FOUND = 'DISCREPANCY_FOUND',
    RESOLVED = 'RESOLVED',
}

/** Stock count item condition */
export enum StockCountItemCondition {
    GOOD = 'GOOD',
    DAMAGED = 'DAMAGED',
    EXPIRED = 'EXPIRED',
    MISSING = 'MISSING',
}

/** Source type for non-conformity reports */
export enum NonconformitySourceType {
    IMPORT = 'IMPORT',
    STOCK_COUNT = 'STOCK_COUNT',
    TRANSFER = 'TRANSFER',
    EXPORT = 'EXPORT',
    MANUAL = 'MANUAL',
}

/** Issue type classification */
export enum IssueType {
    DAMAGED = 'DAMAGED',
    DISCREPANCY = 'DISCREPANCY',
    EXPIRED = 'EXPIRED',
    MISSING = 'MISSING',
    SEAL_BROKEN = 'SEAL_BROKEN',
}

/** Non-conformity report status */
export enum NonconformityStatus {
    OPEN = 'OPEN',
    QUARANTINED = 'QUARANTINED',
    UNDER_REVIEW = 'UNDER_REVIEW',
    RESOLVED = 'RESOLVED',
    CLOSED = 'CLOSED',
}

/** Resolution type for non-conformity */
export enum ResolutionType {
    RETURN = 'RETURN',
    DESTROY = 'DESTROY',
    ADJUST = 'ADJUST',
    REUSE = 'REUSE',
}

/** Quarantine record status */
export enum QuarantineStatus {
    QUARANTINED = 'QUARANTINED',
    RELEASED = 'RELEASED',
    DISPOSED = 'DISPOSED',
}

/** Adjustment type */
export enum AdjustmentType {
    INCREASE = 'INCREASE',
    DECREASE = 'DECREASE',
}

/** Adjustment reference type */
export enum AdjustmentReferenceType {
    NONCONFORMITY = 'NONCONFORMITY',
    STOCK_COUNT = 'STOCK_COUNT',
    SYSTEM_ERROR = 'SYSTEM_ERROR',
    OTHER = 'OTHER',
}

/** Adjustment voucher status */
export enum AdjustmentVoucherStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
}

/** Approval workflow entity type (polymorphic) */
export enum ApprovalEntityType {
    IMPORT_VOUCHER = 'IMPORT_VOUCHER',
    EXPORT_VOUCHER = 'EXPORT_VOUCHER',
    TRANSFER_ORDER = 'TRANSFER_ORDER',
    PURCHASE_ORDER = 'PURCHASE_ORDER',
    ADJUSTMENT_VOUCHER = 'ADJUSTMENT_VOUCHER',
    GIFT_SESSION = 'GIFT_SESSION',
}

/** Approval workflow step status */
export enum ApprovalStatus {
    PENDING = 'PENDING',
    APPROVED = 'APPROVED',
    REJECTED = 'REJECTED',
    CANCELLED = 'CANCELLED',
}

/** Approval method */
export enum ApprovalMethod {
    STANDARD = 'STANDARD',
    REAUTH_REQUIRED = 'REAUTH_REQUIRED',
}

/** Audit log action types */
export enum AuditAction {
    CREATE = 'CREATE',
    UPDATE = 'UPDATE',
    APPROVE = 'APPROVE',
    REJECT = 'REJECT',
    CANCEL = 'CANCEL',
    SOFT_DELETE = 'SOFT_DELETE',
    QUARANTINE = 'QUARANTINE',
    RELEASE = 'RELEASE',
    TRANSFER = 'TRANSFER',
}

/** Attachment file type */
export enum FileType {
    IMAGE = 'IMAGE',
    VIDEO = 'VIDEO',
    DOCUMENT = 'DOCUMENT',
}