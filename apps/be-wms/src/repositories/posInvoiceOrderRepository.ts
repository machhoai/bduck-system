import { db } from "../config/firebase.js";

import { isMissingFirestoreIndexError } from "./firestoreQueryError.js";

export type PosInvoiceOrderRecord = Record<string, unknown> & {
  localOrderId: string;
  hkOrderNumber: string | null;
  invoiceRequestToken?: string;
  warehouseId: string;
  status: string;
  totalAmount: number;
  items: Array<Record<string, unknown>>;
  paidAt?: string;
  createdAt: string;
};

// Resolve the collection inside each request. The Firestore export is a
// request-scoped proxy in local development, so retaining a CollectionReference
// at module load would permanently bind this repository to the default project.
const orders = () => db.collection("pos_orders");

const asPosOrder = (
  value: Record<string, unknown>,
): PosInvoiceOrderRecord => value as PosInvoiceOrderRecord;

export const posInvoiceOrderRepository = {
  async findByInvoiceRequestToken(
    token: string,
  ): Promise<PosInvoiceOrderRecord | null> {
    const snapshot = await orders()
      .where("invoiceRequestToken", "==", token)
      .limit(2)
      .get();
    if (snapshot.size > 1) {
      throw new Error("DUPLICATE_INVOICE_REQUEST_TOKEN");
    }
    return snapshot.empty ? null : asPosOrder(snapshot.docs[0]!.data());
  },

  async listPaidForDate(
    warehouseId: string,
    startIso: string,
    endIso: string,
  ): Promise<PosInvoiceOrderRecord[]> {
    try {
      const snapshot = await orders()
        .where("warehouseId", "==", warehouseId)
        .where("paidAt", ">=", startIso)
        .where("paidAt", "<", endIso)
        .get();
      return snapshot.docs.map((item) => asPosOrder(item.data()));
    } catch (error) {
      if (!isMissingFirestoreIndexError(error)) throw error;

      console.warn(
        "[posInvoiceOrderRepository] Composite index unavailable; using paidAt range fallback.",
        { warehouseId, startIso, endIso },
      );
      const snapshot = await orders()
        .where("paidAt", ">=", startIso)
        .where("paidAt", "<", endIso)
        .get();
      return snapshot.docs
        .map((item) => asPosOrder(item.data()))
        .filter((order) => order.warehouseId === warehouseId);
    }
  },

  async mapByHkOrderNumbers(
    hkOrderNumbers: string[],
  ): Promise<Map<string, PosInvoiceOrderRecord>> {
    const unique = [...new Set(hkOrderNumbers.filter(Boolean))];
    const result = new Map<string, PosInvoiceOrderRecord>();
    for (let cursor = 0; cursor < unique.length; cursor += 30) {
      const chunk = unique.slice(cursor, cursor + 30);
      if (chunk.length === 0) continue;
      const snapshot = await orders()
        .where("hkOrderNumber", "in", chunk)
        .get();
      snapshot.docs.forEach((item) => {
        const order = asPosOrder(item.data());
        if (typeof order.hkOrderNumber === "string" && order.hkOrderNumber) {
          const existing = result.get(order.hkOrderNumber);
          if (
            existing &&
            (existing.localOrderId !== order.localOrderId ||
              existing.warehouseId !== order.warehouseId)
          ) {
            throw new Error("DUPLICATE_POS_HK_ORDER_NUMBER");
          }
          result.set(order.hkOrderNumber, order);
        }
      });
    }
    return result;
  },
};
