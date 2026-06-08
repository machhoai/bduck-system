import { db } from "../config/firebase.js";
import type { ExternalScanQueue, ExternalScanQueueStatus } from "@bduck/shared-types";

const COLLECTION = "external_scan_queue";

export async function findById(id: string): Promise<ExternalScanQueue | null> {
  const snap = await db.collection(COLLECTION).doc(id).get();
  if (!snap.exists) return null;
  const data = snap.data() as ExternalScanQueue;
  return data.is_deleted ? null : data;
}

export async function findByBatchId(batchId: string): Promise<ExternalScanQueue[]> {
  const snap = await db
    .collection(COLLECTION)
    .where("batch_id", "==", batchId)
    .where("is_deleted", "==", false)
    .get();
  return snap.docs.map((d) => d.data() as ExternalScanQueue);
}

export async function findQueuedByLocationAndDate(
  clientId: string,
  locationId: string,
  shiftDateStr: string, // VD: "2026-06-07"
): Promise<ExternalScanQueue[]> {
  // Để đơn giản, ta tìm các bản ghi QUEUED của client + location,
  // sau đó lọc qua shiftDate (hoặc so sánh scan_time)
  const startOfDay = new Date(`${shiftDateStr}T00:00:00Z`);
  const endOfDay = new Date(`${shiftDateStr}T23:59:59Z`);

  const snap = await db
    .collection(COLLECTION)
    .where("client_id", "==", clientId)
    .where("warehouse_location_id", "==", locationId)
    .where("status", "==", "QUEUED")
    .where("is_deleted", "==", false)
    .where("scan_time", ">=", startOfDay)
    .where("scan_time", "<=", endOfDay)
    .get();

  return snap.docs.map((d) => d.data() as ExternalScanQueue);
}

export async function findQueuedByExternalOperator(
  clientId: string,
  operatorIdExternal: string
): Promise<ExternalScanQueue[]> {
  const snap = await db
    .collection(COLLECTION)
    .where("client_id", "==", clientId)
    .where("operator_id_external", "==", operatorIdExternal)
    .where("status", "==", "QUEUED")
    .where("is_deleted", "==", false)
    .orderBy("scan_time", "desc")
    .limit(100)
    .get();

  return snap.docs.map((d) => d.data() as ExternalScanQueue);
}

export async function create(
  data: ExternalScanQueue,
  txn?: FirebaseFirestore.Transaction
): Promise<ExternalScanQueue> {
  const ref = db.collection(COLLECTION).doc(data.id);
  if (txn) {
    txn.set(ref, data);
  } else {
    await ref.set(data);
  }
  return data;
}

export async function update(
  id: string,
  data: Partial<ExternalScanQueue>,
  txn?: FirebaseFirestore.Transaction
): Promise<void> {
  const ref = db.collection(COLLECTION).doc(id);
  if (txn) {
    txn.update(ref, data);
  } else {
    await ref.update(data);
  }
}

export async function softDelete(id: string, txn?: FirebaseFirestore.Transaction): Promise<void> {
  const ref = db.collection(COLLECTION).doc(id);
  if (txn) {
    txn.update(ref, { is_deleted: true });
  } else {
    await ref.update({ is_deleted: true });
  }
}
