import { randomUUID } from "node:crypto";

import { db } from "../config/firebase.js";
import {
  decidePosOrderCancellation,
  type PosOrderCancellationMode,
} from "../services/posOrderPolicy.js";

import { buildPosOrderCancellationAudit } from "./posOrderCancellationAudit.js";
import {
  finalizePosOrderCancellation,
  markPosOrderCancellationFailure,
} from "./posOrderCancellationResultRepository.js";
import {
  buildPosOrderSummaryDocument,
  type RawPosOrder,
} from "./posOrderRepository.js";

export interface PosOrderCancellationOperation {
  operation_id: string;
  local_order_id: string;
  warehouse_id: string;
  mode: PosOrderCancellationMode;
  status: "PENDING" | "REFUNDING" | "SUCCEEDED" | "FAILED" | "UNKNOWN";
  reason: string;
  action_time: string;
  sync_time: string;
  cancelled_by: string;
  cancelled_by_name: string;
  biz_code: string | null;
  remote_order_id: string | null;
  remote_order_number: string | null;
  refund_order_number: string | null;
  last_error: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  is_deleted: false;
}

export class PosOrderCancellationRepositoryError extends Error {
  constructor(
    readonly code: string,
    readonly statusCode: number,
  ) {
    super(code);
  }
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

export const posOrderCancellationRepository = {
  async begin(input: {
    localOrderId: string;
    warehouseId: string;
    expectedVersion: number;
    reason: string;
    actionTime: string;
    actorId: string;
    actorName: string;
    operationId: string;
    bizCode: string;
    allowedModes: ReadonlySet<PosOrderCancellationMode>;
    context?: {
      ip_address?: string | null;
      device_id?: string | null;
      session_token?: string | null;
    };
  }): Promise<{
    created: boolean;
    resumed: boolean;
    order: RawPosOrder;
    operation: PosOrderCancellationOperation;
  }> {
    const orderRef = db.collection("pos_orders").doc(input.localOrderId);
    const operationRef = db
      .collection("pos_order_cancellations")
      .doc(input.localOrderId);
    const sourceQuery = db
      .collection("invoice_source_orders")
      .where("warehouse_id", "==", input.warehouseId)
      .where("local_order_id", "==", input.localOrderId)
      .limit(5);

    return db.runTransaction(async (transaction) => {
      const [orderSnapshot, operationSnapshot, sourceSnapshots] =
        await Promise.all([
          transaction.get(orderRef),
          transaction.get(operationRef),
          transaction.get(sourceQuery),
        ]);
      if (!orderSnapshot.exists) {
        throw new PosOrderCancellationRepositoryError("ORDER_NOT_FOUND", 404);
      }
      const order = orderSnapshot.data() as RawPosOrder;
      if (order.warehouseId !== input.warehouseId) {
        throw new PosOrderCancellationRepositoryError("ORDER_NOT_FOUND", 404);
      }
      if (operationSnapshot.exists) {
        const existing =
          operationSnapshot.data() as PosOrderCancellationOperation;
        if (existing.status === "FAILED") {
          if (!input.allowedModes.has(existing.mode)) {
            throw new PosOrderCancellationRepositoryError(
              "CANCEL_PERMISSION_DENIED",
              403,
            );
          }
          const version = Number(order.version ?? 0);
          if (version !== input.expectedVersion) {
            throw new PosOrderCancellationRepositoryError(
              "ORDER_VERSION_CONFLICT",
              409,
            );
          }
          const now = new Date().toISOString();
          const resumedOperation = {
            ...existing,
            status: "REFUNDING" as const,
            attempt_count: existing.attempt_count + 1,
            last_error: null,
            sync_time: now,
            updated_at: now,
          };
          const resumedOrder = {
            ...order,
            paymentStatus: "REFUNDING",
            version: version + 1,
            updatedAt: now,
          };
          transaction.update(operationRef, resumedOperation);
          transaction.update(orderRef, {
            paymentStatus: resumedOrder.paymentStatus,
            version: resumedOrder.version,
            updatedAt: now,
          });
          transaction.set(
            db.collection("pos_order_summaries").doc(input.localOrderId),
            buildPosOrderSummaryDocument(input.localOrderId, resumedOrder),
            { merge: false },
          );
          const auditId = randomUUID();
          transaction.create(
            db.collection("audit_logs").doc(auditId),
            buildPosOrderCancellationAudit({
              id: auditId,
              order,
              actorId: input.actorId,
              actorName: input.actorName,
              actionTime: input.actionTime,
              oldValue: {
                paymentStatus: order.paymentStatus ?? null,
                cancellationStatus: existing.status,
                attemptCount: existing.attempt_count,
              },
              newValue: {
                paymentStatus: "REFUNDING",
                cancellationStatus: "REFUNDING",
                attemptCount: resumedOperation.attempt_count,
              },
              notes: "Retried JoyWorld refund after a confirmed failed attempt",
              context: input.context,
            }),
          );
          return {
            created: false,
            resumed: true,
            order: resumedOrder,
            operation: resumedOperation,
          };
        }
        return {
          created: false,
          resumed: false,
          order,
          operation: existing,
        };
      }

      const invoiceRefs = sourceSnapshots.docs
        .map((item) => text(item.data().invoice_document_id))
        .filter((item): item is string => Boolean(item))
        .map((id) => db.collection("invoice_documents").doc(id));
      const invoiceSnapshots = await Promise.all(
        invoiceRefs.map((reference) => transaction.get(reference)),
      );
      const invoiceStatuses = [
        ...sourceSnapshots.docs.map(
          (item) => item.data().invoice_document_status,
        ),
        ...invoiceSnapshots.map((item) => item.data()?.status),
      ];
      const decision = decidePosOrderCancellation(order, invoiceStatuses);
      if (!decision.allowed || decision.idempotent) {
        throw new PosOrderCancellationRepositoryError(
          decision.code ?? "ORDER_ALREADY_CANCELLED",
          409,
        );
      }
      if (!input.allowedModes.has(decision.mode)) {
        throw new PosOrderCancellationRepositoryError(
          "CANCEL_PERMISSION_DENIED",
          403,
        );
      }
      const version = Number(order.version ?? 0);
      if (version !== input.expectedVersion) {
        throw new PosOrderCancellationRepositoryError(
          "ORDER_VERSION_CONFLICT",
          409,
        );
      }

      const now = new Date().toISOString();
      const localOnly = decision.mode === "LOCAL_ONLY";
      const paymentStatus = localOnly
        ? order.status === "DRAFT"
          ? "DRAFT"
          : "REFUNDED"
        : "REFUNDING";
      const operation: PosOrderCancellationOperation = {
        operation_id: input.operationId,
        local_order_id: input.localOrderId,
        warehouse_id: input.warehouseId,
        mode: decision.mode,
        status: localOnly ? "SUCCEEDED" : "REFUNDING",
        reason: input.reason,
        action_time: input.actionTime,
        sync_time: now,
        cancelled_by: input.actorId,
        cancelled_by_name: input.actorName,
        biz_code: localOnly ? null : input.bizCode,
        remote_order_id: text(order.remoteOrderId),
        remote_order_number: text(order.hkOrderNumber),
        refund_order_number: null,
        last_error: null,
        attempt_count: localOnly ? 0 : 1,
        created_at: now,
        updated_at: now,
        completed_at: localOnly ? now : null,
        is_deleted: false,
      };
      const orderUpdate = {
        ...(localOnly ? { status: "CANCELLED" } : {}),
        paymentStatus,
        syncStatus: localOnly ? "CANCELLED" : order.syncStatus,
        cancellationOperationId: input.operationId,
        cancelledAt: localOnly ? input.actionTime : null,
        cancelledBy: input.actorId,
        cancelReason: input.reason,
        version: version + 1,
        updatedAt: now,
      };
      transaction.create(operationRef, operation);
      transaction.update(orderRef, orderUpdate);
      transaction.set(
        db.collection("pos_order_summaries").doc(input.localOrderId),
        buildPosOrderSummaryDocument(input.localOrderId, {
          ...order,
          ...orderUpdate,
        }),
        { merge: false },
      );
      const auditId = randomUUID();
      transaction.create(
        db.collection("audit_logs").doc(auditId),
        buildPosOrderCancellationAudit({
          id: auditId,
          order,
          actorId: input.actorId,
          actorName: input.actorName,
          actionTime: input.actionTime,
          oldValue: {
            status: order.status,
            paymentStatus: order.paymentStatus ?? null,
            syncStatus: order.syncStatus ?? null,
          },
          newValue: orderUpdate,
          notes: localOnly
            ? "Cancelled JPOS order locally and disabled remote synchronization"
            : "Started JoyWorld full-order refund",
          context: input.context,
        }),
      );
      return {
        created: true,
        resumed: false,
        order: { ...order, ...orderUpdate },
        operation,
      };
    });
  },

  finalize: finalizePosOrderCancellation,
  markFailure: markPosOrderCancellationFailure,
};
