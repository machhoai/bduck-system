import { db } from "../config/firebase.js";
import type { StockCountItem, StockCountSession } from "@bduck/shared-types";

const SESSIONS = "stock_count_sessions";
const ITEMS = "stock_count_items";

export interface StockCountSessionFilters {
  warehouse_id?: string;
  warehouse_location_id?: string;
  status?: string;
  source?: string;
  business_date?: string;
}

const toMillis = (value: unknown) => {
  if (value instanceof Date) return value.getTime();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }
  return new Date(value as string | number).getTime();
};

export const sessionsCollection = () => db.collection(SESSIONS);
export const itemsCollection = () => db.collection(ITEMS);

export async function findSessionById(
  id: string,
): Promise<StockCountSession | null> {
  const snap = await sessionsCollection().doc(id).get();
  if (!snap.exists) return null;
  const session = snap.data() as StockCountSession;
  return session.is_deleted === false ? session : null;
}

export async function findItemsBySessionId(
  sessionId: string,
): Promise<StockCountItem[]> {
  const snap = await itemsCollection()
    .where("session_id", "==", sessionId)
    .where("is_deleted", "==", false)
    .get();

  return snap.docs
    .map((doc) => doc.data() as StockCountItem)
    .sort(
      (a, b) =>
        (a.created_at ? toMillis(a.created_at) : 0) -
        (b.created_at ? toMillis(b.created_at) : 0),
    );
}

export async function findItemById(id: string): Promise<StockCountItem | null> {
  const snap = await itemsCollection().doc(id).get();
  if (!snap.exists) return null;
  const item = snap.data() as StockCountItem;
  return item.is_deleted === false ? item : null;
}

export async function findSessions(
  filters: StockCountSessionFilters,
): Promise<StockCountSession[]> {
  let query: FirebaseFirestore.Query = sessionsCollection();

  if (filters.warehouse_id) {
    query = query.where("warehouse_id", "==", filters.warehouse_id);
  }
  if (filters.warehouse_location_id) {
    query = query.where(
      "warehouse_location_id",
      "==",
      filters.warehouse_location_id,
    );
  }
  if (filters.status) {
    query = query.where("status", "==", filters.status);
  }
  if (filters.source) {
    query = query.where("source", "==", filters.source);
  }
  if (filters.business_date) {
    query = query.where("business_date", "==", filters.business_date);
  }

  const snap = await query.get();
  return snap.docs
    .map((doc) => doc.data() as StockCountSession)
    .filter((session) => session.is_deleted === false)
    .sort((a, b) => toMillis(b.created_at) - toMillis(a.created_at));
}
