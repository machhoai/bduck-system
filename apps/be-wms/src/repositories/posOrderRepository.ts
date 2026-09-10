import type {
  PosOrderCancellationSummary,
  PosOrderDetail,
  PosOrderInvoiceSummary,
  PosOrderListResult,
  PosOrderSummary,
} from "@bduck/shared-types";
import { FieldPath } from "firebase-admin/firestore";

import { db } from "../config/firebase.js";
import {
  derivePosOrderPaymentStatus,
  derivePosOrderSyncStatus,
  normalizePosOrderPhone,
} from "../services/posOrderPolicy.js";
import type { PosOrderListQuery } from "../services/posOrderSchemas.js";

export type RawPosOrder = Record<string, unknown> & {
  localOrderId: string;
  warehouseId: string;
  status: string;
  totalAmount: number;
  items: Array<Record<string, unknown>>;
  createdAt: string;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;
const number = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;

const mapItems = (value: unknown) =>
  (Array.isArray(value) ? value : []).map((item) => {
    const row = item as Record<string, unknown>;
    return {
      goodsId: text(row.goodsId) ?? "",
      goodsName: text(row.goodsName) ?? "",
      quantity: number(row.quantity),
      price: number(row.price),
    };
  });

export const mapPosOrderSummary = (
  id: string,
  value: Record<string, unknown>,
): PosOrderSummary => {
  const member = (value.member ?? {}) as Record<string, unknown>;
  const items = mapItems(value.items);
  const customerPhone = text(value.customerPhone) ?? text(member.phone);
  return {
    id,
    localOrderId: text(value.localOrderId) ?? id,
    warehouseId: text(value.warehouseId) ?? "",
    source: value.source === "JOYWORLD_IMPORT" ? "JOYWORLD_IMPORT" : "JPOS",
    legacyStatus: text(value.legacyStatus) ?? text(value.status) ?? "DRAFT",
    paymentStatus: derivePosOrderPaymentStatus(value),
    syncStatus: derivePosOrderSyncStatus(value),
    hkOrderNumber: text(value.hkOrderNumber),
    remoteOrderId: text(value.remoteOrderId),
    customerName: text(value.customerName) ?? text(member.fullName),
    customerPhone,
    normalizedPhone:
      text(value.normalizedPhone) ?? normalizePosOrderPhone(customerPhone),
    operatorId: text(value.operatorId) ?? "",
    operatorName: text(value.operatorName) ?? "",
    productNames: Array.isArray(value.productNames)
      ? value.productNames
          .map(text)
          .filter((item): item is string => Boolean(item))
      : Array.from(
          new Set(items.map((item) => item.goodsName).filter(Boolean)),
        ),
    items,
    totalAmount: number(value.totalAmount),
    createdAt: text(value.createdAt) ?? new Date(0).toISOString(),
    paidAt: text(value.paidAt),
    cancelledAt: text(value.cancelledAt),
    version: Math.max(0, Math.trunc(number(value.version))),
  };
};

export const buildPosOrderSummaryDocument = (
  id: string,
  value: Record<string, unknown>,
) => ({
  ...mapPosOrderSummary(id, value),
  is_deleted: false as const,
  updatedAt: text(value.updatedAt) ?? new Date(0).toISOString(),
});

const matches = (order: PosOrderSummary, query: PosOrderListQuery): boolean => {
  const orderCode = query.orderCode?.toLocaleLowerCase("vi");
  const product = query.product?.toLocaleLowerCase("vi");
  return (
    (!orderCode ||
      order.localOrderId.toLocaleLowerCase("vi").includes(orderCode) ||
      Boolean(
        order.hkOrderNumber?.toLocaleLowerCase("vi").includes(orderCode),
      )) &&
    (!query.phone ||
      order.normalizedPhone === normalizePosOrderPhone(query.phone)) &&
    (!query.paymentStatus || order.paymentStatus === query.paymentStatus) &&
    (!query.syncStatus || order.syncStatus === query.syncStatus) &&
    (!query.operatorId || order.operatorId === query.operatorId) &&
    (!product ||
      order.productNames.some((name) =>
        name.toLocaleLowerCase("vi").includes(product),
      ))
  );
};

const encodeCursor = (order: PosOrderSummary, sortBy: string): string =>
  Buffer.from(
    JSON.stringify({
      value: order[sortBy as "createdAt" | "totalAmount"],
      id: order.id,
    }),
  ).toString("base64url");

const decodeCursor = (
  cursor?: string,
): { value: unknown; id: string } | null => {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    return value && typeof value.id === "string" ? value : null;
  } catch {
    return null;
  }
};

const findInvoiceSummary = async (
  localOrderId: string,
  warehouseId: string,
): Promise<PosOrderInvoiceSummary> => {
  const sources = await db
    .collection("invoice_source_orders")
    .where("warehouse_id", "==", warehouseId)
    .where("local_order_id", "==", localOrderId)
    .limit(2)
    .get();
  const source = sources.docs[0];
  const sourceValue = source?.data();
  const documentId = text(sourceValue?.invoice_document_id);
  const document = documentId
    ? await db.collection("invoice_documents").doc(documentId).get()
    : null;
  const documentValue = document?.data();
  const status =
    text(documentValue?.status) ?? text(sourceValue?.invoice_document_status);
  return {
    sourceOrderDocumentId: source?.id ?? null,
    documentId,
    status,
    invoiceNumber: text(documentValue?.invoice_number),
    blocked: [
      "SUBMITTING",
      "PENDING_CONFIRMATION",
      "ISSUED",
      "POST_ISSUE_REVIEW",
      "CLOSED",
    ].includes(status ?? ""),
  };
};

export const posOrderRepository = {
  async list(
    warehouseId: string,
    input: PosOrderListQuery,
  ): Promise<PosOrderListResult> {
    let query = db
      .collection("pos_order_summaries")
      .where("warehouseId", "==", warehouseId)
      .orderBy(input.sortBy, input.sortDir)
      .orderBy(FieldPath.documentId(), input.sortDir);
    const cursor = decodeCursor(input.cursor);
    if (cursor) query = query.startAfter(cursor.value, cursor.id);
    const snapshot = await query
      .limit(Math.min(input.limit * 5 + 1, 500))
      .get();
    const candidates = snapshot.docs
      .filter((document) => document.data().is_deleted !== true)
      .map((document) => mapPosOrderSummary(document.id, document.data()));
    const filtered = candidates.filter((order) => matches(order, input));
    const orders = filtered.slice(0, input.limit);
    const hasNext =
      snapshot.size > input.limit || filtered.length > input.limit;
    const employees = new Map<string, string>();
    candidates.forEach((order) => {
      if (order.operatorId) employees.set(order.operatorId, order.operatorName);
    });
    return {
      orders,
      nextCursor:
        hasNext && orders.length
          ? encodeCursor(orders[orders.length - 1]!, input.sortBy)
          : null,
      employeeOptions: Array.from(employees, ([id, name]) => ({
        id,
        name,
      })).sort((left, right) => left.name.localeCompare(right.name, "vi")),
    };
  },

  async findRaw(localOrderId: string): Promise<RawPosOrder | null> {
    const snapshot = await db.collection("pos_orders").doc(localOrderId).get();
    return snapshot.exists ? (snapshot.data() as RawPosOrder) : null;
  },

  async findDetail(
    localOrderId: string,
    warehouseId: string,
  ): Promise<PosOrderDetail | null> {
    const [snapshot, invoice, cancellationSnapshot] = await Promise.all([
      db.collection("pos_orders").doc(localOrderId).get(),
      findInvoiceSummary(localOrderId, warehouseId),
      db.collection("pos_order_cancellations").doc(localOrderId).get(),
    ]);
    if (!snapshot.exists) return null;
    const value = snapshot.data()!;
    if (text(value.warehouseId) !== warehouseId) return null;
    const summary = mapPosOrderSummary(snapshot.id, value);
    const sync = (value.sync ?? {}) as Record<string, unknown>;
    const member = (value.member ?? {}) as Record<string, unknown>;
    const cancellationValue = cancellationSnapshot.data();
    const cancellation: PosOrderCancellationSummary | null = cancellationValue
      ? {
          operationId:
            text(cancellationValue.operation_id) ?? cancellationSnapshot.id,
          status: cancellationValue.status,
          reason: text(cancellationValue.reason) ?? "",
          actionTime: text(cancellationValue.action_time) ?? "",
          syncTime: text(cancellationValue.sync_time) ?? "",
          cancelledBy: text(cancellationValue.cancelled_by) ?? "",
          refundOrderNumber: text(cancellationValue.refund_order_number),
          lastError: text(cancellationValue.last_error),
        }
      : null;
    return {
      ...summary,
      paymentMethod: text(value.paymentMethod) ?? "",
      paymentMethodId: text(value.paymentMethodId) ?? "",
      paymentMethodName: text(value.paymentMethodName) ?? "",
      memberCode: text(member.memberCode),
      deviceId: text(value.deviceId),
      sync: {
        retryCount: Math.max(0, Math.trunc(number(sync.retryCount))),
        lastError: text(sync.lastError),
        syncedAt: text(sync.syncedAt),
        operationId: text(value.syncOperationId),
      },
      invoice,
      cancellation,
    };
  },
};
