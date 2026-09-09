import { randomUUID } from "node:crypto";

import type {
  PosOrderCancelResult,
  PosOrderDetail,
  PosOrderListResult,
  PosOrderRefundPreview,
} from "@bduck/shared-types";

import { posOrderCancellationRepository } from "../repositories/posOrderCancellationRepository.js";
import {
  mapPosOrderSummary,
  posOrderRepository,
  type RawPosOrder,
} from "../repositories/posOrderRepository.js";

import type { AuditMetadata } from "./auditService.js";
import type { AuthorizationService } from "./authorization/index.js";
import {
  assertJoyworldRefundMatchesLocal,
  createJoyworldBizCode,
  joyworldRefundClient,
  JoyworldRefundError,
} from "./joyworldRefundClient.js";
import { posOrderError as domainError } from "./posOrderErrors.js";
import {
  decidePosOrderCancellation,
  type PosOrderCancellationMode,
} from "./posOrderPolicy.js";
import type {
  PosOrderCancelValue,
  PosOrderListQuery,
} from "./posOrderSchemas.js";

const orderItems = (order: RawPosOrder) =>
  mapPosOrderSummary(order.localOrderId, order).items;

const loadAuthorizedDetail = async (
  warehouseId: string,
  localOrderId: string,
  authorization: AuthorizationService,
): Promise<PosOrderDetail> => {
  authorization.assert("pos.orders.read", warehouseId);
  const detail = await posOrderRepository.findDetail(localOrderId, warehouseId);
  if (!detail) throw domainError("ORDER_NOT_FOUND", 404);
  return detail;
};

export const listPosOrders = async (input: {
  warehouseId: string;
  query: PosOrderListQuery;
  authorization: AuthorizationService;
}): Promise<PosOrderListResult> => {
  input.authorization.assert("pos.orders.read", input.warehouseId);
  return posOrderRepository.list(input.warehouseId, input.query);
};

export const getPosOrder = async (input: {
  warehouseId: string;
  localOrderId: string;
  authorization: AuthorizationService;
}): Promise<PosOrderDetail> =>
  loadAuthorizedDetail(
    input.warehouseId,
    input.localOrderId,
    input.authorization,
  );

const prepareRemoteRefund = async (warehouseId: string, order: RawPosOrder) => {
  const remoteOrderNumber =
    typeof order.hkOrderNumber === "string" ? order.hkOrderNumber : "";
  if (!remoteOrderNumber) throw domainError("REMOTE_ORDER_NOT_FOUND");
  const remoteOrderId = await joyworldRefundClient.resolveRemoteOrderId({
    warehouseId,
    remoteOrderId:
      typeof order.remoteOrderId === "string" ? order.remoteOrderId : null,
    hkOrderNumber: remoteOrderNumber,
    paidAt: typeof order.paidAt === "string" ? order.paidAt : order.createdAt,
    totalAmount: order.totalAmount,
  });
  await joyworldRefundClient.check(warehouseId, remoteOrderId);
  const details = await joyworldRefundClient.getDetails(
    warehouseId,
    remoteOrderId,
  );
  assertJoyworldRefundMatchesLocal({
    localOrderNumber: remoteOrderNumber,
    totalAmount: order.totalAmount,
    paymentMethod:
      typeof order.paymentMethod === "string" ? order.paymentMethod : "",
    items: orderItems(order),
    remote: details,
  });
  return { remoteOrderId, remoteOrderNumber, details };
};

export const getPosOrderRefundPreview = async (input: {
  warehouseId: string;
  localOrderId: string;
  authorization: AuthorizationService;
}): Promise<PosOrderRefundPreview> => {
  const detail = await loadAuthorizedDetail(
    input.warehouseId,
    input.localOrderId,
    input.authorization,
  );
  const decision = decidePosOrderCancellation(detail, [detail.invoice.status]);
  if (!decision.allowed) {
    return {
      mode: decision.mode,
      refundable: false,
      amount: detail.totalAmount,
      paymentMethodNames: detail.paymentMethodName,
      remoteOrderId: detail.remoteOrderId,
      remoteOrderNumber: detail.hkOrderNumber,
      blockedReason: decision.code,
    };
  }
  if (decision.mode === "LOCAL_ONLY") {
    return {
      mode: decision.mode,
      refundable: true,
      amount: detail.totalAmount,
      paymentMethodNames: detail.paymentMethodName,
      remoteOrderId: null,
      remoteOrderNumber: detail.hkOrderNumber,
      blockedReason: null,
    };
  }
  if (!input.authorization.can("pos.orders.refund_remote", input.warehouseId)) {
    return {
      mode: "REMOTE_REFUND",
      refundable: false,
      amount: detail.totalAmount,
      paymentMethodNames: detail.paymentMethodName,
      remoteOrderId: detail.remoteOrderId,
      remoteOrderNumber: detail.hkOrderNumber,
      blockedReason: "CANCEL_PERMISSION_DENIED",
    };
  }
  const raw = await posOrderRepository.findRaw(input.localOrderId);
  if (!raw || raw.warehouseId !== input.warehouseId) {
    throw domainError("ORDER_NOT_FOUND", 404);
  }
  let remote;
  try {
    remote = await prepareRemoteRefund(input.warehouseId, raw);
  } catch (error) {
    const code =
      error instanceof JoyworldRefundError
        ? error.code
        : "REMOTE_REFUND_FAILED";
    throw domainError(code, 502);
  }
  return {
    mode: "REMOTE_REFUND",
    refundable: true,
    amount: remote.details.totalMoney,
    paymentMethodNames: remote.details.payMethodNames,
    remoteOrderId: remote.remoteOrderId,
    remoteOrderNumber: remote.remoteOrderNumber,
    blockedReason: null,
  };
};

export const cancelPosOrder = async (input: {
  warehouseId: string;
  localOrderId: string;
  value: PosOrderCancelValue;
  actorId: string;
  actorName: string;
  authorization: AuthorizationService;
  auditMetadata?: AuditMetadata;
}): Promise<PosOrderCancelResult> => {
  const detail = await loadAuthorizedDetail(
    input.warehouseId,
    input.localOrderId,
    input.authorization,
  );
  const initialDecision = decidePosOrderCancellation(detail, [
    detail.invoice.status,
  ]);
  if (!initialDecision.allowed)
    throw domainError(initialDecision.code ?? "CANCEL_BLOCKED");
  if (initialDecision.idempotent) return { order: detail, idempotent: true };

  const allowedModes = new Set<PosOrderCancellationMode>();
  if (input.authorization.can("pos.orders.cancel_local", input.warehouseId)) {
    allowedModes.add("LOCAL_ONLY");
  }
  if (input.authorization.can("pos.orders.refund_remote", input.warehouseId)) {
    allowedModes.add("REMOTE_REFUND");
  }
  if (!allowedModes.has(initialDecision.mode)) {
    throw domainError("CANCEL_PERMISSION_DENIED", 403);
  }
  if (
    initialDecision.mode === "REMOTE_REFUND" &&
    !input.value.refundConfirmed
  ) {
    throw domainError("REFUND_CONFIRMATION_REQUIRED", 400);
  }

  let begun;
  try {
    begun = await posOrderCancellationRepository.begin({
      localOrderId: input.localOrderId,
      warehouseId: input.warehouseId,
      expectedVersion: input.value.expectedVersion,
      reason: input.value.reason,
      actionTime: input.value.action_time,
      actorId: input.actorId,
      actorName: input.actorName,
      operationId: randomUUID(),
      bizCode: createJoyworldBizCode(),
      allowedModes,
      context: input.auditMetadata,
    });
  } catch (error) {
    const code = (error as { code?: string }).code;
    throw domainError(
      code ?? "CANCEL_FAILED",
      (error as { statusCode?: number }).statusCode,
    );
  }

  if (!begun.created && begun.operation.status === "SUCCEEDED") {
    const order = await loadAuthorizedDetail(
      input.warehouseId,
      input.localOrderId,
      input.authorization,
    );
    return { order, idempotent: true };
  }
  if (
    !begun.created &&
    !begun.resumed &&
    ["UNKNOWN", "REFUNDING"].includes(begun.operation.status)
  ) {
    throw domainError(
      begun.operation.status === "UNKNOWN"
        ? "REFUND_UNKNOWN"
        : "REFUND_IN_PROGRESS",
    );
  }
  if (begun.operation.mode === "LOCAL_ONLY") {
    const order = await loadAuthorizedDetail(
      input.warehouseId,
      input.localOrderId,
      input.authorization,
    );
    return { order, idempotent: false };
  }

  let remoteOrderId = "";
  let refundOrderNumber = "";
  try {
    const remote = await prepareRemoteRefund(input.warehouseId, begun.order);
    remoteOrderId = remote.remoteOrderId;
    refundOrderNumber = await joyworldRefundClient.submit({
      warehouseId: input.warehouseId,
      bizCode: begun.operation.biz_code!,
      remoteOrderId,
      reason: begun.operation.reason,
      details: remote.details,
    });
  } catch (error) {
    const unknown = error instanceof JoyworldRefundError && error.uncertain;
    const code =
      error instanceof Error ? error.message : "REMOTE_REFUND_FAILED";
    await posOrderCancellationRepository.markFailure({
      localOrderId: input.localOrderId,
      operationId: begun.operation.operation_id,
      unknown,
      error: code,
    });
    throw domainError(unknown ? "REFUND_UNKNOWN" : code, unknown ? 409 : 502);
  }

  try {
    await posOrderCancellationRepository.finalize({
      localOrderId: input.localOrderId,
      operationId: begun.operation.operation_id,
      actorId: input.actorId,
      actorName: input.actorName,
      remoteOrderId,
      refundOrderNumber,
    });
  } catch {
    await posOrderCancellationRepository.markFailure({
      localOrderId: input.localOrderId,
      operationId: begun.operation.operation_id,
      unknown: true,
      error: "LOCAL_FINALIZATION_AFTER_REMOTE_SUCCESS_FAILED",
      remoteOrderId,
      refundOrderNumber,
    });
    throw domainError("REFUND_UNKNOWN", 409);
  }

  const order = await loadAuthorizedDetail(
    input.warehouseId,
    input.localOrderId,
    input.authorization,
  );
  return { order, idempotent: false };
};
