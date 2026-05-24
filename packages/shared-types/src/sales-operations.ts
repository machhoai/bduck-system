// Giao dịch POS và xuất quà tặng theo ca

import { GiftSessionStatus, PosTransactionStatus, PosTransactionType } from "./enums.js";

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
