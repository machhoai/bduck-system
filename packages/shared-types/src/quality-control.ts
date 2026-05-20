// Xử lý sự cố, hàng lỗi, cách ly, điều chỉnh

import { NonconformitySourceType, IssueType, NonconformityStatus, ResolutionType, QuarantineStatus, AdjustmentType, AdjustmentReferenceType, AdjustmentVoucherStatus } from "./enums";

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