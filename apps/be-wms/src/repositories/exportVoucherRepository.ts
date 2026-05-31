/**
 * Export Voucher Repository — Firestore CRUD
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURE:
 * - Repository layer: ONLY handles Firestore read/write.
 * - NO business logic, no validation, no audit logging.
 * - Business logic belongs in exportVoucherService.ts.
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import type { ExportVoucher } from "@bduck/shared-types";

const COLLECTION = "export_vouchers";

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

export async function findById(id: string): Promise<ExportVoucher | null> {
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as ExportVoucher;
}

export async function findAll(filters?: {
  warehouse_id?: string;
  status?: string;
}): Promise<ExportVoucher[]> {
  let query: FirebaseFirestore.Query = db
    .collection(COLLECTION)
    .where("is_deleted", "==", false);

  if (filters?.warehouse_id) {
    query = query.where("warehouse_id", "==", filters.warehouse_id);
  }
  if (filters?.status) {
    query = query.where("status", "==", filters.status);
  }

  const snap = await query.orderBy("created_at", "desc").get();
  return snap.docs.map((d) => d.data() as ExportVoucher);
}

export async function findByStatuses(
  statuses: string[],
): Promise<ExportVoucher[]> {
  if (statuses.length === 0) return [];
  const snap = await db
    .collection(COLLECTION)
    .where("is_deleted", "==", false)
    .where("status", "in", statuses)
    .orderBy("created_at", "desc")
    .get();
  return snap.docs.map((d) => d.data() as ExportVoucher);
}

// ─────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────

export async function create(
  data: ExportVoucher,
): Promise<ExportVoucher> {
  await db.collection(COLLECTION).doc(data.id).set(data);
  return data;
}

export async function update(
  id: string,
  data: Partial<
    Pick<
      ExportVoucher,
      | "status"
      | "approver_id"
      | "approved_at"
      | "atp_deducted"
      | "updated_at"
      | "sync_time"
      | "notes"
    >
  >,
): Promise<void> {
  await db.collection(COLLECTION).doc(id).update(data);
}

export async function softDelete(id: string): Promise<void> {
  await db.collection(COLLECTION).doc(id).update({
    is_deleted: true,
    updated_at: new Date(),
  });
}
