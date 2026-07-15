/**
 * Transfer Order Repository — Firestore CRUD
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURE:
 * - Repository layer: ONLY handles Firestore read/write.
 * - NO business logic, no validation, no audit logging.
 * - Business logic belongs in transferOrderService.ts.
 * ═══════════════════════════════════════════════════════════════
 */

import { db } from "../config/firebase.js";
import type { TransferOrder, TransferOrderItem } from "@bduck/shared-types";

const COLLECTION = "transfer_orders";
const ITEMS_SUB = "items";

// ─────────────────────────────────────────────
// READ
// ─────────────────────────────────────────────

export async function findById(id: string): Promise<TransferOrder | null> {
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  return snap.data() as TransferOrder;
}

export async function findAll(filters?: {
  source_warehouse_id?: string;
  destination_warehouse_id?: string;
  transfer_type?: string;
  status?: string;
}): Promise<TransferOrder[]> {
  let query: FirebaseFirestore.Query = db
    .collection(COLLECTION)
    .where("is_deleted", "==", false);

  if (filters?.source_warehouse_id) {
    query = query.where(
      "source_warehouse_id",
      "==",
      filters.source_warehouse_id,
    );
  }
  if (filters?.destination_warehouse_id) {
    query = query.where(
      "destination_warehouse_id",
      "==",
      filters.destination_warehouse_id,
    );
  }
  if (filters?.transfer_type) {
    query = query.where("transfer_type", "==", filters.transfer_type);
  }
  if (filters?.status) {
    query = query.where("status", "==", filters.status);
  }

  const snap = await query.orderBy("created_at", "desc").get();
  return snap.docs.map((d) => d.data() as TransferOrder);
}

type TransferFilters = Parameters<typeof findAll>[0];
type TransferFacilityField = "source_warehouse_id" | "destination_warehouse_id";

const applyFilters = (
  initialQuery: FirebaseFirestore.Query,
  filters: TransferFilters,
  scopedField?: TransferFacilityField,
): FirebaseFirestore.Query => {
  let query = initialQuery.where("is_deleted", "==", false);
  const facilityFilters = [
    ["source_warehouse_id", filters?.source_warehouse_id],
    ["destination_warehouse_id", filters?.destination_warehouse_id],
  ] as const;
  for (const [field, value] of facilityFilters) {
    if (value && field !== scopedField) query = query.where(field, "==", value);
  }
  if (filters?.transfer_type) {
    query = query.where("transfer_type", "==", filters.transfer_type);
  }
  if (filters?.status) query = query.where("status", "==", filters.status);
  return query;
};

export async function findAllByFacilityScope(
  field: TransferFacilityField,
  facilityIds: readonly string[],
  filters?: TransferFilters,
): Promise<TransferOrder[]> {
  const selectedFacilityId =
    field === "source_warehouse_id"
      ? filters?.source_warehouse_id
      : filters?.destination_warehouse_id;
  if (selectedFacilityId && !facilityIds.includes(selectedFacilityId))
    return [];

  let query = applyFilters(db.collection(COLLECTION), filters, field);
  query = selectedFacilityId
    ? query.where(field, "==", selectedFacilityId)
    : query.where(field, "in", [...facilityIds]);
  const snapshot = await query.get();
  return snapshot.docs.map((doc) => doc.data() as TransferOrder);
}

// ─────────────────────────────────────────────
// ITEMS
// ─────────────────────────────────────────────

export async function findItemsByOrderId(
  orderId: string,
): Promise<TransferOrderItem[]> {
  const snap = await db
    .collection(COLLECTION)
    .doc(orderId)
    .collection(ITEMS_SUB)
    .where("is_deleted", "==", false)
    .get();
  return snap.docs.map((d) => d.data() as TransferOrderItem);
}

// ─────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────

export async function create(data: TransferOrder): Promise<TransferOrder> {
  await db.collection(COLLECTION).doc(data.id).set(data);
  return data;
}

export async function createItem(
  orderId: string,
  item: TransferOrderItem,
): Promise<void> {
  await db
    .collection(COLLECTION)
    .doc(orderId)
    .collection(ITEMS_SUB)
    .doc(item.id)
    .set(item);
}

export async function update(
  id: string,
  data: Partial<
    Pick<
      TransferOrder,
      | "status"
      | "approver_id"
      | "approved_at"
      | "export_voucher_id"
      | "received_by"
      | "received_at"
      | "dispatched_at"
      | "updated_at"
      | "sync_time"
      | "notes"
    >
  >,
): Promise<void> {
  await db.collection(COLLECTION).doc(id).update(data);
}

export async function updateItem(
  orderId: string,
  itemId: string,
  data: Partial<
    Pick<
      TransferOrderItem,
      "destination_location_id" | "received_quantity" | "status"
    >
  >,
): Promise<void> {
  await db
    .collection(COLLECTION)
    .doc(orderId)
    .collection(ITEMS_SUB)
    .doc(itemId)
    .update(data);
}

export async function softDelete(id: string): Promise<void> {
  await db.collection(COLLECTION).doc(id).update({
    is_deleted: true,
    updated_at: new Date(),
  });
}
