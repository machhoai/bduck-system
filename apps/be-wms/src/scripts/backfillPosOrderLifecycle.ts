/* eslint-disable no-console */
import { FieldPath } from "firebase-admin/firestore";

import { db } from "../config/firebase.js";
import { mapPosOrderSummary } from "../repositories/posOrderRepository.js";
import {
  derivePosOrderPaymentStatus,
  derivePosOrderSyncStatus,
} from "../services/posOrderPolicy.js";

const apply = process.argv.includes("--apply");
const PAGE_SIZE = 300;

async function run() {
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  let scanned = 0;
  let changed = 0;
  do {
    let query = db
      .collection("pos_orders")
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    if (snapshot.empty) break;
    const batch = db.batch();
    snapshot.docs.forEach((document) => {
      const value = document.data();
      const lifecycle = {
        source:
          value.source ??
          (value.historicalImport?.sourceSystem === "JOYWORLD"
            ? "JOYWORLD_IMPORT"
            : "JPOS"),
        paymentStatus: derivePosOrderPaymentStatus(value),
        syncStatus: derivePosOrderSyncStatus(value),
        version: Number.isInteger(value.version) ? value.version : 0,
        remoteOrderId:
          value.remoteOrderId ?? value.historicalImport?.sourceOrderId ?? null,
      };
      const summary = mapPosOrderSummary(document.id, {
        ...value,
        ...lifecycle,
      });
      scanned += 1;
      if (
        value.paymentStatus !== lifecycle.paymentStatus ||
        value.syncStatus !== lifecycle.syncStatus ||
        value.source !== lifecycle.source ||
        value.version === undefined ||
        value.remoteOrderId === undefined
      ) {
        changed += 1;
      }
      if (apply) {
        batch.set(document.ref, lifecycle, { merge: true });
        batch.set(
          db.collection("pos_order_summaries").doc(document.id),
          { ...summary, is_deleted: false, updatedAt: value.updatedAt },
          { merge: false },
        );
      }
    });
    if (apply) await batch.commit();
    cursor = snapshot.docs[snapshot.docs.length - 1] ?? null;
    console.log({ scanned, changed, mode: apply ? "apply" : "dry-run" });
  } while (cursor);
}

run().catch((error) => {
  console.error("[backfillPosOrderLifecycle] failed", error);
  process.exitCode = 1;
});
