// Tồn kho thực tế và Kiểm kê

import { StockCountType, StockCountSessionStatus, StockCountItemCondition } from "./enums";

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
    warehouse_location_id: string; // FK → warehouse_locations
    product_id: string; // FK → products
    total_quantity: number; // ATP
    atp_quantity: number; // Available To Promise
    on_hold_quantity: number;
    in_transit_quantity: number;
    quarantine_quantity: number;
    last_count_at: Date | null;
    last_updated_at: Date;
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