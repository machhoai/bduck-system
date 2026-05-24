// Phê duyệt, Audit log và Tệp đính kèm

import { ApprovalEntityType, ApprovalStatus, ApprovalMethod, AuditAction, FileType } from "./enums.js";

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
    action: AuditAction;
    user_id: string; // FK → users
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