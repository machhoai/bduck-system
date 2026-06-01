// Chứng từ xuất, nhập, điều chuyển, mua hàng

import { ImportVoucherStatus, ItemCondition, ExportType, ExportVoucherStatus, ExportReferenceType, TransferType, TransferOrderStatus, TransferItemStatus, PurchaseOrderStatus } from "./enums.js";

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
    attachment_urls: string[]; // Firebase Storage download URLs
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface ImportVoucherItem {
    id: string; // UUID, PK
    import_voucher_id: string; // FK → import_vouchers
    product_id: string; // FK → products
    warehouse_location_id: string | null; // FK → warehouse_locations (nullable until receiving)
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
    recipient_name: string | null; // Người nhận hàng
    recipient_department: string | null; // Bộ phận nhận
    notes: string | null;
    attachment_urls: string[]; // Firebase Storage download URLs
    action_time: Date; // ISO — client offline time
    sync_time: Date; // ISO — server receive time
    atp_deducted: boolean; // Idempotency flag for ATP deduction
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
}

export interface ExportVoucherItem {
    id: string; // UUID, PK
    export_voucher_id: string; // FK → export_vouchers
    product_id: string; // FK → products
    warehouse_location_id: string; // FK → warehouse_locations
    quantity: number; // Requested quantity
    picked_quantity: number; // Actual picked by warehouse staff
    unit_price: number; // DECIMAL
    notes: string | null;
    is_deleted: boolean;
}

// ─────────────────────────────────────────────
// TRANSFER ORDERS (ISO 8.5.2 · Transactional)
// ─────────────────────────────────────────────

/**
 * Transfer between warehouses or within a warehouse.
 *
 * INTRA_WAREHOUSE: Location A → Location B (same warehouse)
 *   - auto_approve by default, inventory moved in single transaction
 *   - destination_warehouse_id === source_warehouse_id
 *
 * INTER_WAREHOUSE: Warehouse A → Warehouse B
 *   - Full pipeline: Approve → Export → Pick → Ship → Receive → Complete
 *   - Must be wrapped in DB transaction (ISO 8.5.2):
 *     1. Decrease atp_quantity at source, increase in_transit_quantity
 *     2. On receive: decrease in_transit, increase atp at destination
 *     3. Failure at any step → ROLLBACK
 *
 * FIRESTORE LIMIT: Max 150 items per transfer (500 write limit safeguard)
 */
export interface TransferOrder {
    id: string; // UUID, PK
    order_number: string; // TRF-I-{SEQ} or TRF-X-{SEQ}
    transfer_type: TransferType; // INTRA_WAREHOUSE | INTER_WAREHOUSE
    source_warehouse_id: string; // FK → warehouses (REQUIRED)
    destination_warehouse_id: string; // FK → warehouses (REQUIRED, same as source for INTRA)
    status: TransferOrderStatus;
    creator_id: string; // FK → users
    approver_id: string | null; // FK → users
    approved_at: Date | null;
    // ── Export link (INTER only) ──
    export_voucher_id: string | null; // FK → export_vouchers
    // ── Receiving (INTER only) ──
    received_by: string | null; // FK → users
    received_at: Date | null;
    dispatched_at: Date | null;
    // ── Attachments ──
    attachment_urls: string[]; // Firebase Storage download URLs
    // ── Config snapshot (frozen at creation time) ──
    config_snapshot: {
        auto_approve: boolean;
        auto_create_export: boolean;
        require_receiving: boolean;
        require_evidence: boolean;
    } | null;
    // ── Re-authentication (ISO — high-value transfer) ──
    requires_reauth: boolean;
    reauth_confirmed_by: string | null; // FK → users
    reauth_confirmed_at: Date | null;
    // ── ISO timestamps ──
    action_time: Date; // Client offline time
    sync_time: Date; // Server receive time
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
    destination_location_id: string | null; // FK → warehouse_locations (INTRA: required at create, INTER: set on receive)
    quantity: number; // Requested transfer quantity
    received_quantity: number | null; // Actual received (set during receiving phase)
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
