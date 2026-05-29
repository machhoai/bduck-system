/**
 * Import Voucher Query Service — Read-only queries (SRP)
 *
 * ═══════════════════════════════════════════════════════════════
 * DESIGN: Separated from importVoucherService.ts (write ops)
 * to follow Single Responsibility Principle.
 *
 * RBAC: Every query filters by the user's warehouse scope.
 * Users see: vouchers they created + vouchers in their scoped warehouses.
 *
 * TIMELINE: Uses audit_logs + pending_approvals (Fixed Pipeline).
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import type {
  ImportVoucher,
  ImportVoucherItem,
  AuditLog,
  ApprovalRecord,
  Attachment,
} from "@bduck/shared-types";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

export interface ImportVoucherFilters {
  status?: string;
  creator_id?: string;
  approver_id?: string;
  warehouse_id?: string;
  voucher_number?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  cursor?: string;
}

export interface ImportVoucherWithMeta extends ImportVoucher {
  item_count?: number;
}

export interface ImportVoucherDetail extends ImportVoucher {
  items: ImportVoucherItem[];
  attachments: Attachment[];
}

export interface TimelineEvent {
  id: string;
  type: "audit" | "approval";
  action: string;
  user_id: string | null;
  user_name?: string | null;
  timestamp: Date;
  details: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/**
 * Extract warehouse IDs that the user has permission for.
 * permissions structure: { global: {...}, warehouseId1: {...}, ... }
 */
function getUserWarehouseScope(
  permissions: Record<string, Record<string, unknown>>,
  action: string,
): { isGlobal: boolean; warehouseIds: string[] } {
  const globalPerms = permissions["global"] || {};

  // Admin wildcard → global access
  if (globalPerms["*"] === true || globalPerms[action] === true) {
    return { isGlobal: true, warehouseIds: [] };
  }

  // Collect warehouse IDs where user has the action
  const warehouseIds: string[] = [];
  for (const [scope, perms] of Object.entries(permissions)) {
    if (scope === "global") continue;
    if (perms["*"] === true || perms[action] === true) {
      warehouseIds.push(scope);
    }
  }

  return { isGlobal: false, warehouseIds };
}

// ─────────────────────────────────────────────
// 1. FETCH IMPORT VOUCHERS (List with filters)
// ─────────────────────────────────────────────

export async function fetchImportVouchers(
  filters: ImportVoucherFilters,
  userId: string,
  permissions: Record<string, Record<string, unknown>>,
): Promise<ImportVoucherWithMeta[]> {
  const scope = getUserWarehouseScope(permissions, "vouchers.read");

  let query = db
    .collection("import_vouchers")
    .where("is_deleted", "==", false)
    .orderBy("created_at", "desc");

  // ── Status filter ──
  if (filters.status) {
    query = query.where("status", "==", filters.status);
  }

  // ── Warehouse filter ──
  if (filters.warehouse_id) {
    query = query.where("warehouse_id", "==", filters.warehouse_id);
  }

  // ── Date range ──
  if (filters.date_from) {
    query = query.where("created_at", ">=", new Date(filters.date_from));
  }
  if (filters.date_to) {
    query = query.where("created_at", "<=", new Date(filters.date_to));
  }

  // ── Limit ──
  const limit = Math.min(filters.limit || 50, 100);
  query = query.limit(limit);

  // ── Cursor (pagination) ──
  if (filters.cursor) {
    const cursorDoc = await db
      .collection("import_vouchers")
      .doc(filters.cursor)
      .get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.get();
  const vouchers: ImportVoucherWithMeta[] = [];

  for (const doc of snapshot.docs) {
    const data = doc.data() as ImportVoucher;

    // ── RBAC filter: user's own + scoped warehouses ──
    if (!scope.isGlobal) {
      const isCreator = data.creator_id === userId;
      const inScope = scope.warehouseIds.includes(data.warehouse_id);
      if (!isCreator && !inScope) continue;
    }

    // ── Client-side filters (Firestore limitation: can't combine inequality on multiple fields) ──
    if (filters.creator_id && data.creator_id !== filters.creator_id) continue;
    if (filters.approver_id && data.approver_id !== filters.approver_id)
      continue;
    if (
      filters.voucher_number &&
      !data.voucher_number
        .toLowerCase()
        .includes(filters.voucher_number.toLowerCase())
    )
      continue;

    vouchers.push(data);
  }

  return vouchers;
}

// ─────────────────────────────────────────────
// 2. FETCH IMPORT VOUCHER BY ID (Detail)
// ─────────────────────────────────────────────

export async function fetchImportVoucherById(
  id: string,
  userId: string,
  permissions: Record<string, Record<string, unknown>>,
): Promise<ImportVoucherDetail | null> {
  const voucherRef = db.collection("import_vouchers").doc(id);
  const voucherSnap = await voucherRef.get();

  if (!voucherSnap.exists) return null;

  const voucher = voucherSnap.data() as ImportVoucher;
  if (voucher.is_deleted) return null;

  // ── RBAC check ──
  const scope = getUserWarehouseScope(permissions, "vouchers.read");
  if (!scope.isGlobal) {
    const isCreator = voucher.creator_id === userId;
    const inScope = scope.warehouseIds.includes(voucher.warehouse_id);
    if (!isCreator && !inScope) return null;
  }

  // ── Fetch items ──
  const itemsSnap = await voucherRef
    .collection("items")
    .where("is_deleted", "==", false)
    .get();

  const items: ImportVoucherItem[] = itemsSnap.docs.map(
    (doc) => doc.data() as ImportVoucherItem,
  );

  // ── Fetch attachments ──
  const attachSnap = await db
    .collection("attachments")
    .where("entity_type", "==", "IMPORT_VOUCHER")
    .where("entity_id", "==", id)
    .orderBy("created_at", "desc")
    .get();

  const attachments: Attachment[] = attachSnap.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as Attachment,
  );

  return { ...voucher, items, attachments };
}

// ─────────────────────────────────────────────
// 3. FETCH TIMELINE (Audit + Approval events)
// ─────────────────────────────────────────────

export async function fetchImportVoucherTimeline(
  voucherId: string,
): Promise<TimelineEvent[]> {
  const events: TimelineEvent[] = [];

  // ── Audit logs for this voucher ──
  const auditSnap = await db
    .collection("audit_logs")
    .where("entity_id", "==", voucherId)
    .orderBy("action_time", "desc")
    .limit(50)
    .get();

  for (const doc of auditSnap.docs) {
    const data = doc.data() as AuditLog;
    events.push({
      id: doc.id,
      type: "audit",
      action: data.action,
      user_id: data.user_id,
      user_name: data.user_name || null,
      timestamp: data.action_time,
      details: {
        old_value: data.old_value,
        new_value: data.new_value,
        notes: data.notes,
      },
    });
  }

  // ── Approval records for this voucher (Fixed Pipeline) ──
  const approvalSnap = await db
    .collection("pending_approvals")
    .where("entity_type", "==", "IMPORT_VOUCHER")
    .where("entity_id", "==", voucherId)
    .get();

  for (const doc of approvalSnap.docs) {
    const approval = doc.data() as ApprovalRecord;
    events.push({
      id: doc.id,
      type: "approval",
      action: `APPROVAL_${approval.status}`,
      user_id: approval.approver_id || approval.creator_id,
      timestamp: approval.approved_at || approval.created_at,
      details: {
        level: approval.level,
        role_id: approval.role_id,
        status: approval.status,
        rejected_reason: approval.rejected_reason,
        comments: approval.comments,
      },
    });
  }

  // ── Sort all events by timestamp DESC ──
  events.sort((a, b) => {
    const tA = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp as unknown as string).getTime();
    const tB = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp as unknown as string).getTime();
    return tB - tA;
  });

  return events;
}
