import { db } from "../config/firebase.js";

const runs = db.collection("invoice_bulk_issue_runs");

export const invoiceBulkIssueRepository = {
  async getRun(id: string, warehouseId: string) {
    const snapshot = await runs.doc(id).get();
    if (!snapshot.exists) return null;
    const value = snapshot.data() as Record<string, unknown>;
    return value.warehouse_id === warehouseId ? value : null;
  },

  async createRun(id: string, value: Record<string, unknown>) {
    const ref = runs.doc(id);
    return db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (snapshot.exists) {
        return { created: false, run: snapshot.data() as Record<string, unknown> };
      }
      transaction.create(ref, { id, ...value });
      return { created: true, run: { id, ...value } };
    });
  },

  async updateRun(id: string, value: Record<string, unknown>) {
    await runs.doc(id).set(value, { merge: true });
  },
};

