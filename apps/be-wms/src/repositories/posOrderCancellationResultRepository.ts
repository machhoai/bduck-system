import { randomUUID } from "node:crypto";

import { db } from "../config/firebase.js";

import { buildPosOrderCancellationAudit } from "./posOrderCancellationAudit.js";
import { type PosOrderCancellationOperation } from "./posOrderCancellationRepository.js";
import type { RawPosOrder } from "./posOrderRepository.js";

export const finalizePosOrderCancellation = async (input: {
  localOrderId: string;
  operationId: string;
  actorId: string;
  actorName: string;
  remoteOrderId: string;
  refundOrderNumber: string;
}): Promise<void> => {
  const orderRef = db.collection("pos_orders").doc(input.localOrderId);
  const operationRef = db
    .collection("pos_order_cancellations")
    .doc(input.localOrderId);
  await db.runTransaction(async (transaction) => {
    const [orderSnapshot, operationSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(operationRef),
    ]);
    if (!orderSnapshot.exists || !operationSnapshot.exists) return;
    const order = orderSnapshot.data() as RawPosOrder;
    const operation = operationSnapshot.data() as PosOrderCancellationOperation;
    if (operation.operation_id !== input.operationId) return;
    if (operation.status === "SUCCEEDED") return;
    const now = new Date().toISOString();
    const orderUpdate = {
      paymentStatus: "REFUNDED",
      syncStatus: "CANCELLED",
      remoteOrderId: input.remoteOrderId,
      refundOrderNumber: input.refundOrderNumber,
      cancelledAt: operation.action_time,
      cancelledBy: operation.cancelled_by,
      cancelReason: operation.reason,
      version: Number(order.version ?? 0) + 1,
      updatedAt: now,
    };
    transaction.update(orderRef, orderUpdate);
    transaction.update(operationRef, {
      status: "SUCCEEDED",
      remote_order_id: input.remoteOrderId,
      refund_order_number: input.refundOrderNumber,
      last_error: null,
      sync_time: now,
      updated_at: now,
      completed_at: now,
    });
    const auditId = randomUUID();
    transaction.create(
      db.collection("audit_logs").doc(auditId),
      buildPosOrderCancellationAudit({
        id: auditId,
        order,
        actorId: input.actorId,
        actorName: input.actorName,
        actionTime: operation.action_time,
        oldValue: {
          paymentStatus: order.paymentStatus ?? null,
          syncStatus: order.syncStatus ?? null,
        },
        newValue: orderUpdate,
        notes: "JoyWorld refund succeeded and local cancellation finalized",
      }),
    );
  });
};

export const markPosOrderCancellationFailure = async (input: {
  localOrderId: string;
  operationId: string;
  unknown: boolean;
  error: string;
  remoteOrderId?: string;
  refundOrderNumber?: string;
}): Promise<void> => {
  const orderRef = db.collection("pos_orders").doc(input.localOrderId);
  const operationRef = db
    .collection("pos_order_cancellations")
    .doc(input.localOrderId);
  await db.runTransaction(async (transaction) => {
    const [orderSnapshot, operationSnapshot] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(operationRef),
    ]);
    if (!orderSnapshot.exists || !operationSnapshot.exists) return;
    const order = orderSnapshot.data() as RawPosOrder;
    const operation = operationSnapshot.data() as PosOrderCancellationOperation;
    if (
      operation.operation_id !== input.operationId ||
      operation.status === "SUCCEEDED"
    ) {
      return;
    }
    const now = new Date().toISOString();
    const paymentStatus = input.unknown ? "REFUND_UNKNOWN" : "REFUND_FAILED";
    const orderUpdate = {
      paymentStatus,
      ...(input.remoteOrderId ? { remoteOrderId: input.remoteOrderId } : {}),
      ...(input.refundOrderNumber
        ? { refundOrderNumber: input.refundOrderNumber }
        : {}),
      version: Number(order.version ?? 0) + 1,
      updatedAt: now,
    };
    transaction.update(orderRef, orderUpdate);
    transaction.update(operationRef, {
      status: input.unknown ? "UNKNOWN" : "FAILED",
      last_error: input.error.slice(0, 1_000),
      ...(input.remoteOrderId ? { remote_order_id: input.remoteOrderId } : {}),
      ...(input.refundOrderNumber
        ? { refund_order_number: input.refundOrderNumber }
        : {}),
      sync_time: now,
      updated_at: now,
    });
    const auditId = randomUUID();
    transaction.create(
      db.collection("audit_logs").doc(auditId),
      buildPosOrderCancellationAudit({
        id: auditId,
        order,
        actorId: operation.cancelled_by,
        actorName: operation.cancelled_by_name,
        actionTime: operation.action_time,
        oldValue: {
          paymentStatus: order.paymentStatus ?? null,
          cancellationStatus: operation.status,
        },
        newValue: {
          ...orderUpdate,
          cancellationStatus: input.unknown ? "UNKNOWN" : "FAILED",
          lastError: input.error.slice(0, 1_000),
        },
        notes: input.unknown
          ? "JoyWorld refund outcome requires manual reconciliation"
          : "JoyWorld refund failed before a confirmed success",
      }),
    );
  });
};
