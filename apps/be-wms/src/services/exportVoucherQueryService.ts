/**
 * Export Voucher Query Service — Read-only queries
 *
 * Separates query logic from state machine logic
 * for cleaner architecture and smaller file sizes.
 */

import { db } from "../config/firebase.js";
import { ExportVoucherStatus } from "@bduck/shared-types";
import type { ExportVoucher, ExportVoucherItem } from "@bduck/shared-types";

const COLLECTION = "export_vouchers";

const ACTIVE_STATUSES = [
  ExportVoucherStatus.DRAFT,
  ExportVoucherStatus.PENDING_APPROVAL,
  ExportVoucherStatus.APPROVED,
  ExportVoucherStatus.REJECTED,
  ExportVoucherStatus.PICKING,
  ExportVoucherStatus.SHIPPED,
];

const COMPLETED_STATUSES = [
  ExportVoucherStatus.COMPLETED,
  ExportVoucherStatus.CANCELLED,
];

/** Fetch vouchers in active states (for "Đang xử lý" tab) */
export async function fetchActiveVouchers(): Promise<ExportVoucher[]> {
  const snap = await db
    .collection(COLLECTION)
    .where("is_deleted", "==", false)
    .where("status", "in", ACTIVE_STATUSES)
    .orderBy("created_at", "desc")
    .get();
  return snap.docs.map((d) => d.data() as ExportVoucher);
}

/** Fetch completed/cancelled vouchers (for "Lịch sử" tab) */
export async function fetchCompletedVouchers(): Promise<ExportVoucher[]> {
  const snap = await db
    .collection(COLLECTION)
    .where("is_deleted", "==", false)
    .where("status", "in", COMPLETED_STATUSES)
    .orderBy("created_at", "desc")
    .get();
  return snap.docs.map((d) => d.data() as ExportVoucher);
}

/** Fetch single voucher by ID with items */
export async function fetchVoucherWithItems(
  voucherId: string,
): Promise<{ voucher: ExportVoucher; items: ExportVoucherItem[] } | null> {
  const voucherSnap = await db.collection(COLLECTION).doc(voucherId).get();
  if (!voucherSnap.exists) return null;

  const voucher = voucherSnap.data() as ExportVoucher;
  const itemsSnap = await db
    .collection(COLLECTION)
    .doc(voucherId)
    .collection("items")
    .where("is_deleted", "==", false)
    .get();

  const items = itemsSnap.docs.map((d) => d.data() as ExportVoucherItem);
  return { voucher, items };
}

/** Fetch all vouchers (admin view) */
export async function fetchAllVouchers(filters?: {
  warehouse_id?: string;
}): Promise<ExportVoucher[]> {
  let query: FirebaseFirestore.Query = db
    .collection(COLLECTION)
    .where("is_deleted", "==", false);

  if (filters?.warehouse_id) {
    query = query.where("warehouse_id", "==", filters.warehouse_id);
  }

  const snap = await query.orderBy("created_at", "desc").get();
  return snap.docs.map((d) => d.data() as ExportVoucher);
}
