import type {
  ApprovalRecord,
  Attachment,
  AuditLog,
  ImportVoucher,
  ImportVoucherItem,
} from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { executeFacilityScopedQuery } from "../repositories/facilityScopedQuery.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  assertVoucherAccess,
  loadImportVoucher,
} from "./voucherAccessPolicy.js";

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

const toMillis = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  return new Date(value as string).getTime();
};

const queryImportVouchers = async (
  filters: ImportVoucherFilters,
  warehouseIds?: readonly string[],
): Promise<ImportVoucher[]> => {
  let query: FirebaseFirestore.Query = db
    .collection("import_vouchers")
    .where("is_deleted", "==", false);
  if (warehouseIds) query = query.where("warehouse_id", "in", warehouseIds);
  if (filters.warehouse_id) {
    query = query.where("warehouse_id", "==", filters.warehouse_id);
  }
  if (filters.status) query = query.where("status", "==", filters.status);
  if (filters.date_from) {
    query = query.where("created_at", ">=", new Date(filters.date_from));
  }
  if (filters.date_to) {
    query = query.where("created_at", "<=", new Date(filters.date_to));
  }
  query = query.orderBy("created_at", "desc").limit(100);
  if (filters.cursor) {
    const cursor = await db
      .collection("import_vouchers")
      .doc(filters.cursor)
      .get();
    if (cursor.exists) query = query.startAfter(cursor);
  }
  const snapshot = await query.get();
  return snapshot.docs.map(
    (document) => ({ id: document.id, ...document.data() }) as ImportVoucher,
  );
};

export const fetchImportVouchers = async (
  filters: ImportVoucherFilters,
  authorization: AuthorizationService,
): Promise<ImportVoucher[]> => {
  let groups: readonly (readonly ImportVoucher[])[];
  if (filters.warehouse_id) {
    assertVoucherAccess(authorization, "vouchers.read", filters.warehouse_id);
    groups = [await queryImportVouchers(filters)];
  } else {
    groups = await executeFacilityScopedQuery({
      isSystemAdmin: authorization.context.isSystemAdmin,
      facilityIds: authorization.facilityIdsFor("vouchers.read"),
      queryAll: () => queryImportVouchers(filters),
      queryChunk: (warehouseIds) => queryImportVouchers(filters, warehouseIds),
    });
  }
  const voucherNumber = filters.voucher_number?.toLowerCase();
  return groups
    .flat()
    .filter(
      (voucher, index, vouchers) =>
        vouchers.findIndex((candidate) => candidate.id === voucher.id) ===
          index &&
        (!filters.creator_id || voucher.creator_id === filters.creator_id) &&
        (!filters.approver_id || voucher.approver_id === filters.approver_id) &&
        (!voucherNumber ||
          voucher.voucher_number.toLowerCase().includes(voucherNumber)),
    )
    .sort(
      (left, right) => toMillis(right.created_at) - toMillis(left.created_at),
    )
    .slice(0, Math.min(filters.limit ?? 50, 100));
};

export const fetchImportVoucherById = async (
  id: string,
  authorization: AuthorizationService,
): Promise<ImportVoucherDetail> => {
  const voucher = await loadImportVoucher(id);
  assertVoucherAccess(authorization, "vouchers.read", voucher.warehouse_id);
  const voucherReference = db.collection("import_vouchers").doc(id);
  const [itemsSnapshot, attachmentsSnapshot] = await Promise.all([
    voucherReference.collection("items").where("is_deleted", "==", false).get(),
    db
      .collection("attachments")
      .where("entity_type", "==", "IMPORT_VOUCHER")
      .where("entity_id", "==", id)
      .orderBy("created_at", "desc")
      .get(),
  ]);
  return {
    ...voucher,
    items: itemsSnapshot.docs.map(
      (document) => document.data() as ImportVoucherItem,
    ),
    attachments: attachmentsSnapshot.docs.map(
      (document) => ({ id: document.id, ...document.data() }) as Attachment,
    ),
  };
};

export const fetchImportVoucherTimeline = async (
  voucherId: string,
  authorization: AuthorizationService,
): Promise<TimelineEvent[]> => {
  const voucher = await loadImportVoucher(voucherId);
  assertVoucherAccess(authorization, "vouchers.read", voucher.warehouse_id);
  const [auditSnapshot, approvalSnapshot] = await Promise.all([
    db
      .collection("audit_logs")
      .where("entity_id", "==", voucherId)
      .orderBy("action_time", "desc")
      .limit(50)
      .get(),
    db
      .collection("pending_approvals")
      .where("entity_type", "==", "IMPORT_VOUCHER")
      .where("entity_id", "==", voucherId)
      .get(),
  ]);
  const events: TimelineEvent[] = auditSnapshot.docs.map((document) => {
    const audit = document.data() as AuditLog;
    return {
      id: document.id,
      type: "audit",
      action: audit.action,
      user_id: audit.user_id,
      user_name: audit.user_name || null,
      timestamp: audit.action_time,
      details: {
        old_value: audit.old_value,
        new_value: audit.new_value,
        notes: audit.notes,
      },
    };
  });
  approvalSnapshot.docs.forEach((document) => {
    const approval = document.data() as ApprovalRecord;
    events.push({
      id: document.id,
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
  });
  return events.sort(
    (left, right) => toMillis(right.timestamp) - toMillis(left.timestamp),
  );
};
