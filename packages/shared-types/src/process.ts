/**
 * Process Pipeline — Fixed Pipeline + Configurable Steps
 *
 * ═══════════════════════════════════════════════════════════════
 * REPLACES: Dynamic Workflow Engine (WorkflowDefinition, Instance, Task)
 *
 * DESIGN:
 * - Pipeline steps are HARDCODED in each entity's service
 * - Step options (approval chains, evidence requirements) are
 *   CONFIGURABLE in Firestore via ProcessConfig
 * - No DAG, no visual builder, no runtime engine
 *
 * COLLECTIONS:
 *   process_configs     → ProcessConfig  (admin-managed)
 *   pending_approvals   → ApprovalRecord (runtime, per-voucher)
 * ═══════════════════════════════════════════════════════════════
 */

// ─────────────────────────────────────────────
// PROCESS ENTITY TYPES
// ─────────────────────────────────────────────

/**
 * All entity types that go through approval pipelines.
 * Each has its own hardcoded state machine in its service.
 *
 * TRANSFER_ORDER  = Inter-warehouse transfers (full pipeline)
 * TRANSFER_INTRA  = Intra-warehouse transfers (simplified, auto-approve by default)
 */
export type ProcessEntityType =
  | 'IMPORT_VOUCHER'
  | 'EXPORT_VOUCHER'
  | 'TRANSFER_ORDER'
  | 'TRANSFER_INTRA'
  | 'PURCHASE_ORDER'
  | 'ADJUSTMENT_VOUCHER'
  | 'GIFT_SESSION';

/** Map entity type → Firestore collection name */
export const ENTITY_COLLECTIONS: Record<ProcessEntityType, string> = {
  IMPORT_VOUCHER: 'import_vouchers',
  EXPORT_VOUCHER: 'export_vouchers',
  TRANSFER_ORDER: 'transfer_orders',
  TRANSFER_INTRA: 'transfer_orders', // Same collection, different config
  PURCHASE_ORDER: 'purchase_orders',
  ADJUSTMENT_VOUCHER: 'adjustment_vouchers',
  GIFT_SESSION: 'gift_sessions',
};

// ─────────────────────────────────────────────
// APPROVAL LEVEL (config)
// ─────────────────────────────────────────────

/**
 * One level in the approval chain.
 *
 * Example:
 *   level 0: WAREHOUSE_MANAGER (required=true → always active)
 *   level 1: DIRECTOR (required=false, enabled=false → optional, off by default)
 *
 * Toggle enabled=true via admin UI → Director approval added automatically.
 */
export interface ApprovalLevel {
  /** Sequential level (0-based). Lower = first to approve. */
  level: number;
  /** Role that can approve at this level (FK → roles.id) */
  role_id: string;
  /** Localized label for UI display */
  label: { vi: string; zh: string };
  /**
   * true  → This level is always active, cannot be toggled off.
   * false → This level is optional, admin can toggle `enabled`.
   */
  required: boolean;
  /**
   * Whether this level is currently active.
   * Only meaningful when required=false.
   * When required=true, this is always treated as true.
   */
  enabled: boolean;
  /**
   * How many distinct approvers are needed at this level.
   * Default = 1. Set to 2 if e.g. "2 Directors must approve".
   */
  min_approvers: number;
}

// ─────────────────────────────────────────────
// STEP OPTION (config per pipeline step)
// ─────────────────────────────────────────────

/**
 * Who is allowed to perform a data-entry step.
 * - CREATOR: Only the user who created the voucher
 * - ROLE: Only users belonging to the specified role (assigned_role_id)
 */
export type StepAssignmentMode = 'CREATOR' | 'ROLE';

/**
 * Configurable options for a specific step in the pipeline.
 * Key = step identifier (e.g. "receiving", "picking", "qc", "handover")
 */
export interface StepOption {
  /** Bắt buộc upload evidence (ảnh/file) ở bước này? */
  require_evidence: boolean;
  /** Bắt buộc scan barcode trước khi xác nhận? */
  require_barcode_scan: boolean;
  /**
   * Who is assigned to perform this step.
   * CREATOR = the voucher creator; ROLE = specific role via assigned_role_id.
   */
  assignment_mode: StepAssignmentMode;
  /**
   * FK → roles.id. Required when assignment_mode = "ROLE".
   * Ignored (should be null) when assignment_mode = "CREATOR".
   */
  assigned_role_id: string | null;
  /** Custom label override (null = use default i18n) */
  label: { vi: string; zh: string } | null;
}

// ─────────────────────────────────────────────
// PROCESS CONFIG (Firestore: process_configs)
// ─────────────────────────────────────────────

/**
 * Top-level configuration for a business process.
 *
 * One config per entity_type (+ optional warehouse_id scope).
 * Admin manages this via the Process Config UI page.
 *
 * LOOKUP PRIORITY:
 *   1. Config with matching (entity_type + warehouse_id)
 *   2. Config with matching (entity_type + warehouse_id=null) → global default
 *   3. Hardcoded fallback in code
 */
export interface ProcessConfig {
  id: string;
  /** Which entity type this config applies to */
  entity_type: ProcessEntityType;
  /** Warehouse scope — null = global default for all warehouses */
  warehouse_id: string | null;
  /** Configurable approval chain */
  approval_chain: ApprovalLevel[];
  /**
   * When true, the entire approval_chain is SKIPPED.
   * Entity auto-advances to APPROVED immediately upon creation.
   * The approval_chain data is PRESERVED (non-destructive toggle).
   */
  auto_approve: boolean;
  /** Per-step options (key = step name like "receiving", "picking") */
  step_options: Record<string, StepOption>;
  /** Soft delete (ISO 9001 — no hard deletes) */
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

// ─────────────────────────────────────────────
// APPROVAL RECORD STATUS
// ─────────────────────────────────────────────

export type ApprovalRecordStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

// ─────────────────────────────────────────────
// APPROVAL RECORD (Firestore: pending_approvals)
// ─────────────────────────────────────────────

/**
 * Runtime approval record — one per approval level per voucher.
 *
 * When min_approvers > 1, multiple records are created at the same level
 * (one per required approver).
 *
 * SELF-APPROVAL BLOCK (ISO 9001 · Segregation of Duties):
 *   creator_id is stored on each record. The approval service MUST
 *   reject any attempt where approver_id === creator_id.
 */
export interface ApprovalRecord {
  id: string;
  /** Which entity type (IMPORT_VOUCHER, EXPORT_VOUCHER, etc.) */
  entity_type: ProcessEntityType;
  /** FK → voucher/order ID */
  entity_id: string;
  /** FK → warehouses (denormalized for scoped queries) */
  warehouse_id: string;
  /** Sequential level (0-based, matches ApprovalLevel.level) */
  level: number;
  /** Role required to approve (FK → roles.id) */
  role_id: string;
  /** Current status */
  status: ApprovalRecordStatus;
  /** Who approved/rejected this record (null = still pending) */
  approver_id: string | null;
  /** When the approval/rejection occurred */
  approved_at: Date | null;
  /** Reason for rejection (null if approved or pending) */
  rejected_reason: string | null;
  /** Comments from approver (optional) */
  comments: string | null;
  /**
   * SELF-APPROVAL BLOCK: The user who created the voucher.
   * approvalService.approveLevel() checks: approver_id !== creator_id
   */
  creator_id: string;
  /** ISO — local time when the approval action was performed */
  action_time: Date;
  /** ISO — server receive time */
  sync_time: Date;
  created_at: Date;

  // ── Denormalized display fields (for TaskCard) ──
  /** Voucher/order number for display (e.g. "NK-250605-001") */
  voucher_number?: string;
  /** Creator's display name (denormalized from users collection) */
  creator_name?: string;
}
