import { createHash, randomUUID } from "node:crypto";
import { db } from "../config/firebase.js";

const orders = db.collection("invoice_source_orders");
const payloads = db.collection("invoice_source_order_payloads");
const runs = db.collection("invoice_order_sync_runs");
const WRITE_CHUNK_SIZE = 140;

export interface SourceOrderWrite {
  source_order_id: string;
  source_payload_hash: string;
  projection: Record<string, unknown>;
  raw_payload: Record<string, unknown>;
}

export interface SourceOrderWriteResult {
  inserted_count: number;
  updated_count: number;
  unchanged_count: number;
}

export const invoiceSourceOrderDocumentId = (
  warehouseId: string,
  sourceOrderId: string,
) =>
  createHash("sha256")
    .update(`${warehouseId}:JOYWORLD:${sourceOrderId}`)
    .digest("hex");

export const invoiceOrderRepository = {
  async createRun(value: Record<string, unknown>): Promise<string> {
    const id = randomUUID();
    await runs.doc(id).set({ id, ...value });
    return id;
  },

  async updateRun(id: string, value: Record<string, unknown>): Promise<void> {
    await runs.doc(id).set(value, { merge: true });
  },

  async upsertOrders(
    warehouseId: string,
    runId: string,
    values: SourceOrderWrite[],
    syncTime: Date,
  ): Promise<SourceOrderWriteResult> {
    const result: SourceOrderWriteResult = {
      inserted_count: 0,
      updated_count: 0,
      unchanged_count: 0,
    };

    for (let cursor = 0; cursor < values.length; cursor += WRITE_CHUNK_SIZE) {
      const chunk = values.slice(cursor, cursor + WRITE_CHUNK_SIZE);
      const refs = chunk.map((value) =>
        orders.doc(
          invoiceSourceOrderDocumentId(warehouseId, value.source_order_id),
        ),
      );
      const revisionRefs = chunk.map((value, index) =>
        payloads
          .doc(refs[index].id)
          .collection("revisions")
          .doc(value.source_payload_hash),
      );
      const allSnapshots =
        refs.length > 0 ? await db.getAll(...refs, ...revisionRefs) : [];
      const snapshots = allSnapshots.slice(0, refs.length);
      const revisionSnapshots = allSnapshots.slice(refs.length);
      const batch = db.batch();

      chunk.forEach((value, index) => {
        const orderRef = refs[index];
        const snapshot = snapshots[index];
        const previous = snapshot.exists
          ? (snapshot.data() as Record<string, unknown>)
          : null;
        const changed =
          previous?.source_payload_hash !== value.source_payload_hash;
        if (!previous) result.inserted_count += 1;
        else if (changed) result.updated_count += 1;
        else result.unchanged_count += 1;

        const id = orderRef.id;
        batch.set(
          orderRef,
          {
            id,
            warehouse_id: warehouseId,
            ...value.projection,
            source_payload_hash: value.source_payload_hash,
            last_sync_run_id: runId,
            source_sync_time: syncTime,
            updated_at: syncTime,
            created_at: previous?.created_at ?? syncTime,
            is_deleted: false,
            ...(previous
              ? {}
              : {
                  match_status: "NOT_CHECKED",
                  invoice_document_id: null,
                  invoice_document_status: null,
                }),
          },
          { merge: true },
        );

        const payloadRef = payloads.doc(id);
        batch.set(
          payloadRef,
          {
            id,
            warehouse_id: warehouseId,
            source_order_id: value.source_order_id,
            source_payload_hash: value.source_payload_hash,
            latest_payload: value.raw_payload,
            last_sync_run_id: runId,
            source_sync_time: syncTime,
            updated_at: syncTime,
            created_at: previous?.created_at ?? syncTime,
          },
          { merge: true },
        );

        if (changed && !revisionSnapshots[index]?.exists) {
          batch.create(revisionRefs[index], {
            id: value.source_payload_hash,
            warehouse_id: warehouseId,
            source_order_id: value.source_order_id,
            source_payload_hash: value.source_payload_hash,
            payload: value.raw_payload,
            first_seen_run_id: runId,
            first_seen_at: syncTime,
          });
        }
      });

      await batch.commit();
    }

    return result;
  },

  async listOrders(warehouseId: string, businessDate: string) {
    const snapshot = await orders
      .where("warehouse_id", "==", warehouseId)
      .where("business_date", "==", businessDate)
      .where("is_deleted", "==", false)
      .orderBy("source_action_time", "desc")
      .get();
    return snapshot.docs.map((document) => document.data());
  },

  async getOrder(id: string, warehouseId: string) {
    const snapshot = await orders.doc(id).get();
    if (!snapshot.exists) return null;
    const data = snapshot.data() as Record<string, unknown>;
    if (data.warehouse_id !== warehouseId || data.is_deleted === true)
      return null;
    return data;
  },
};
