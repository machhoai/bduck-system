// Chứng từ xuất, nhập, điều chuyển, mua hàng

import { ImportVoucherStatus, ItemCondition, ExportType, ExportVoucherStatus, ExportReferenceType, TransferOrderStatus, TransferItemStatus, PurchaseOrderStatus } from "./enums";

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
