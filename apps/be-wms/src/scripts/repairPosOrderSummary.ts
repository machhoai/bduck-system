/* eslint-disable no-console */
import { randomUUID } from "node:crypto";

import { db, getCurrentFirebaseProjectId } from "../config/firebase.js";
import { runWithLocalFirebaseTarget } from "../config/firebaseTargetContext.js";
import { buildPosOrderCancellationAudit } from "../repositories/posOrderCancellationAudit.js";
import {
  buildPosOrderSummaryDocument,
  type RawPosOrder,
} from "../repositories/posOrderRepository.js";

const args = new Map(
  process.argv.slice(2).map((argument) => {
    const [key, ...valueParts] = argument.split("=");
    return [key, valueParts.join("=")];
  }),
);
const orderId = args.get("--order-id")?.trim();
const confirmedProject = args.get("--confirm-project")?.trim();
const apply = process.argv.includes("--apply");

if (!orderId) throw new Error("Missing --order-id=<local order id>.");
if (confirmedProject !== "jw-system-f2104") {
  throw new Error("Production repair requires --confirm-project=jw-system-f2104.");
}
const validatedOrderId = orderId;
const validatedProject = confirmedProject;

async function run() {
  await runWithLocalFirebaseTarget("jw-system-f2104", async () => {
    const projectId = getCurrentFirebaseProjectId();
    if (projectId !== validatedProject) {
      throw new Error(`Connected to ${projectId}, expected ${validatedProject}.`);
    }

    const orderRef = db.collection("pos_orders").doc(validatedOrderId);
    const summaryRef = db.collection("pos_order_summaries").doc(validatedOrderId);
    const operationRef = db
      .collection("pos_order_cancellations")
      .doc(validatedOrderId);

    if (!apply) {
      const [orderSnapshot, summarySnapshot, operationSnapshot] =
        await Promise.all([
          orderRef.get(),
          summaryRef.get(),
          operationRef.get(),
        ]);
      console.log({
        mode: "dry-run",
        projectId,
        orderId: validatedOrderId,
        order: orderSnapshot.data(),
        summary: summarySnapshot.data(),
        cancellation: operationSnapshot.data(),
      });
      return;
    }

    await db.runTransaction(async (transaction) => {
      const [orderSnapshot, summarySnapshot, operationSnapshot] =
        await Promise.all([
          transaction.get(orderRef),
          transaction.get(summaryRef),
          transaction.get(operationRef),
        ]);
      if (!orderSnapshot.exists) throw new Error("POS order does not exist.");
      if (!operationSnapshot.exists) {
        throw new Error("Cancellation operation does not exist.");
      }

      const order = orderSnapshot.data() as RawPosOrder;
      const operation = operationSnapshot.data() as Record<string, unknown>;
      if (
        order.paymentStatus !== "REFUNDED" ||
        order.syncStatus !== "CANCELLED" ||
        operation.status !== "SUCCEEDED"
      ) {
        throw new Error(
          "Refusing repair: order is not a confirmed successful cancellation.",
        );
      }

      const previousSummary = summarySnapshot.data() ?? {};
      const repairedSummary = buildPosOrderSummaryDocument(
        validatedOrderId,
        order,
      );
      transaction.set(summaryRef, repairedSummary, { merge: false });
      const auditId = randomUUID();
      transaction.create(
        db.collection("audit_logs").doc(auditId),
        buildPosOrderCancellationAudit({
          id: auditId,
          order,
          actorId: "system-pos-order-repair",
          actorName: "System POS order repair",
          actionTime: new Date().toISOString(),
          oldValue: {
            paymentStatus: previousSummary.paymentStatus ?? null,
            syncStatus: previousSummary.syncStatus ?? null,
            version: previousSummary.version ?? null,
            updatedAt: previousSummary.updatedAt ?? null,
          },
          newValue: {
            paymentStatus: repairedSummary.paymentStatus ?? null,
            syncStatus: repairedSummary.syncStatus ?? null,
            version: repairedSummary.version ?? null,
            updatedAt: repairedSummary.updatedAt ?? null,
          },
          notes:
            "Repaired stale POS order summary after confirmed JoyWorld refund.",
        }),
      );
    });

    const repaired = await summaryRef.get();
    console.log({
      mode: "applied",
      projectId,
      orderId: validatedOrderId,
      summary: repaired.data(),
    });
  });
}

run().catch((error) => {
  console.error("[repairPosOrderSummary] failed", error);
  process.exitCode = 1;
});
