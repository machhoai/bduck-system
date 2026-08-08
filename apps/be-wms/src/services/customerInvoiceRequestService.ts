import { createHash } from "node:crypto";
import {
  InvoiceDocumentStatus,
  InvoiceOrderSyncPurpose,
  InvoiceOrderSyncRunStatus,
  type CustomerInvoiceRequestPublicView,
  type InvoiceDraftBuyer,
} from "@bduck/shared-types";
import { invoiceCustomerRequestRepository } from "../repositories/invoiceCustomerRequestRepository.js";
import { invoiceDocumentRepository } from "../repositories/invoiceDocumentRepository.js";
import {
  invoiceOrderRepository,
  invoiceSourceOrderDocumentId,
} from "../repositories/invoiceOrderRepository.js";
import {
  meInvoiceConfigRepository,
  type StoredMeInvoiceAccount,
} from "../repositories/meInvoiceConfigRepository.js";
import {
  posInvoiceOrderRepository,
  type PosInvoiceOrderRecord,
} from "../repositories/posInvoiceOrderRepository.js";
import { ensureInitialInvoiceDocument } from "./invoiceDocumentService.js";
import { canEditInvoiceDocument } from "./invoiceDocumentPolicy.js";
import { buildPosInvoiceSourceOrder, posOrderIsPaid } from "./invoicePosOrderAdapter.js";
import type { CustomerInvoiceRequestSubmission } from "./customerInvoiceRequestSchemas.js";
import {
  customerInvoiceRequestBusinessDate,
  customerInvoiceRequestDeadline,
  customerInvoiceRequestIsExpired,
} from "./customerInvoiceRequestDeadline.js";
import { toPublicStoreConfig } from "./meInvoiceStoreConfigService.js";

type JsonRecord = Record<string, unknown>;

const serviceError = (
  statusCode: number,
  vi: string,
  zh: string,
  code: string,
) => ({ statusCode, messages: { vi, zh }, data: { code } });

const loadPosOrder = async (token: string) => {
  const order = await posInvoiceOrderRepository.findByInvoiceRequestToken(token);
  if (!order || !posOrderIsPaid(order)) {
    throw serviceError(
      404,
      "Liên kết yêu cầu hóa đơn không tồn tại hoặc đơn hàng chưa thanh toán.",
      "发票申请链接不存在或订单尚未付款。",
      "INVOICE_REQUEST_NOT_FOUND",
    );
  }
  return order;
};

const findSourceOrder = async (order: PosInvoiceOrderRecord) => {
  const jposId = invoiceSourceOrderDocumentId(
    order.warehouseId,
    order.localOrderId,
    "JPOS",
  );
  const jposSource = await invoiceOrderRepository.getOrder(
    jposId,
    order.warehouseId,
  );
  if (jposSource) return jposSource;
  return order.hkOrderNumber
    ? invoiceOrderRepository.findByOrderNumber(
        order.hkOrderNumber,
        order.warehouseId,
      )
    : null;
};

const loadInvoiceConfig = async (warehouseId: string) => {
  const stored = await meInvoiceConfigRepository.getStoreConfig(warehouseId);
  if (!stored || stored.is_deleted === true) {
    throw serviceError(
      422,
      "Điểm bán chưa được cấu hình để nhận yêu cầu hóa đơn.",
      "销售点尚未配置发票申请功能。",
      "STORE_CONFIG_MISSING",
    );
  }
  const storeConfig = toPublicStoreConfig(stored);
  const account = await meInvoiceConfigRepository.getAccount(
    storeConfig.meinvoice_account_id,
  );
  if (!account || account.is_deleted === true) {
    throw serviceError(
      422,
      "Không tìm thấy tài khoản hóa đơn của điểm bán.",
      "找不到销售点的发票账户。",
      "MEINVOICE_ACCOUNT_MISSING",
    );
  }
  return { storeConfig, account };
};

const ensureSourceAndDocument = async (order: PosInvoiceOrderRecord) => {
  let source = await findSourceOrder(order);
  const { storeConfig, account } = await loadInvoiceConfig(order.warehouseId);
  if (!source) {
    const businessDate = customerInvoiceRequestBusinessDate(
      order.paidAt ?? order.createdAt,
    );
    const write = buildPosInvoiceSourceOrder(
      order,
      businessDate,
      storeConfig,
      account as StoredMeInvoiceAccount,
    );
    const startedAt = new Date();
    const runId = await invoiceOrderRepository.createRun({
      warehouse_id: order.warehouseId,
      business_date: businessDate,
      purpose: InvoiceOrderSyncPurpose.ISSUE,
      status: InvoiceOrderSyncRunStatus.RUNNING,
      order_count: 1,
      inserted_count: 0,
      updated_count: 0,
      unchanged_count: 0,
      error_code: null,
      requested_by: "public-customer",
      started_at: startedAt,
      completed_at: null,
    });
    const counts = await invoiceOrderRepository.upsertOrders(
      order.warehouseId,
      runId,
      [write],
      startedAt,
    );
    await invoiceOrderRepository.updateRun(runId, {
      status: InvoiceOrderSyncRunStatus.COMPLETED,
      ...counts,
      completed_at: new Date(),
    });
    const id = invoiceSourceOrderDocumentId(
      order.warehouseId,
      order.localOrderId,
      "JPOS",
    );
    source = await invoiceOrderRepository.getOrder(id, order.warehouseId);
  }
  if (!source) {
    throw new Error("INVOICE_SOURCE_ORDER_CREATE_FAILED");
  }

  const sourceId = String(source.id);
  let document = await invoiceDocumentRepository.getDocument(
    sourceId,
    order.warehouseId,
  );
  if (!document) {
    await ensureInitialInvoiceDocument(
      source,
      storeConfig,
      account as StoredMeInvoiceAccount,
      "public-customer",
    );
    document = await invoiceDocumentRepository.getDocument(
      sourceId,
      order.warehouseId,
    );
  }
  if (!document) {
    throw serviceError(
      409,
      "Đơn hàng chưa đủ dữ liệu để tạo bản nháp hóa đơn.",
      "订单数据不足，无法创建发票草稿。",
      "INVOICE_DOCUMENT_NOT_READY",
    );
  }
  return { source, document, sourceId };
};

const publicStatus = (
  paymentTime: string,
  source: JsonRecord | null,
  document: JsonRecord | null,
): "AVAILABLE" | "SUBMITTED" | "EXPIRED" | "LOCKED" => {
  if (customerInvoiceRequestIsExpired(paymentTime)) return "EXPIRED";
  if (
    document &&
    !canEditInvoiceDocument(document.status as InvoiceDocumentStatus)
  ) {
    return "LOCKED";
  }
  return source?.customer_invoice_request_status === "SUBMITTED"
    ? "SUBMITTED"
    : "AVAILABLE";
};

const toPublicView = (
  order: PosInvoiceOrderRecord,
  source: JsonRecord | null,
  document: JsonRecord | null,
): CustomerInvoiceRequestPublicView => {
  const paymentTime = order.paidAt ?? order.createdAt;
  const status = publicStatus(paymentTime, source, document);
  return {
    order_reference: order.hkOrderNumber ?? order.localOrderId,
    local_order_id: order.localOrderId,
    hk_order_number: order.hkOrderNumber ?? null,
    total_amount: order.totalAmount,
    payment_time: paymentTime,
    expires_at: customerInvoiceRequestDeadline(paymentTime).toISOString(),
    status,
    buyer:
      status === "SUBMITTED" && document?.buyer
        ? (document.buyer as InvoiceDraftBuyer)
        : null,
  };
};

export const getCustomerInvoiceRequest = async (token: string) => {
  const order = await loadPosOrder(token);
  const source = await findSourceOrder(order);
  const document = source
    ? await invoiceDocumentRepository.getDocument(
        String(source.id),
        order.warehouseId,
      )
    : null;
  return toPublicView(order, source, document);
};

export const assertCustomerInvoiceRequestAcceptsInput = (
  view: CustomerInvoiceRequestPublicView,
) => {
  if (view.status !== "EXPIRED") return;
  throw serviceError(
    410,
    "Thời hạn cung cấp thông tin hóa đơn đã kết thúc lúc 22:00 ngày thanh toán.",
    "发票信息提交期限已于付款当日22:00结束。",
    "INVOICE_REQUEST_EXPIRED",
  );
};

export const submitCustomerInvoiceRequest = async (input: {
  token: string;
  submission: CustomerInvoiceRequestSubmission;
  ipAddress: string | null;
  deviceId: string | null;
}) => {
  const receivedAt = new Date();
  const order = await loadPosOrder(input.token);
  const paymentTime = order.paidAt ?? order.createdAt;
  if (customerInvoiceRequestIsExpired(paymentTime, receivedAt)) {
    assertCustomerInvoiceRequestAcceptsInput(
      toPublicView(order, null, null),
    );
  }
  const { source, document, sourceId } = await ensureSourceAndDocument(order);
  const syncTime = receivedAt;
  const actionTime = new Date(input.submission.action_time);
  if (
    actionTime.getTime() > syncTime.getTime() + 5 * 60 * 1_000 ||
    actionTime.getTime() < syncTime.getTime() - 30 * 24 * 60 * 60 * 1_000
  ) {
    throw serviceError(
      400,
      "Thời gian gửi yêu cầu không hợp lệ.",
      "提交申请的时间无效。",
      "INVALID_ACTION_TIME",
    );
  }
  const buyer: InvoiceDraftBuyer = {
    ...input.submission.buyer,
    full_name:
      input.submission.buyer.full_name ||
      input.submission.buyer.legal_name,
  };
  const tokenHash = createHash("sha256").update(input.token).digest("hex");
  const requestId = createHash("sha256")
    .update(`${tokenHash}:${input.submission.idempotency_key}`)
    .digest("hex");
  const result = await invoiceCustomerRequestRepository.applyBuyer({
    requestId,
    invoiceDocumentId: sourceId,
    warehouseId: order.warehouseId,
    localOrderId: order.localOrderId,
    hkOrderNumber: order.hkOrderNumber ?? null,
    tokenHash,
    idempotencyKey: input.submission.idempotency_key,
    buyer,
    allowedStatuses: Object.values(InvoiceDocumentStatus).filter((status) =>
      canEditInvoiceDocument(status),
    ),
    nextReadyStatus: InvoiceDocumentStatus.READY_TO_ISSUE,
    actionTime,
    syncTime,
    ipAddress: input.ipAddress,
    deviceId: input.deviceId,
  });
  return {
    ...toPublicView(
      order,
      {
        ...source,
        customer_invoice_request_status: "SUBMITTED",
      },
      result.document ?? document,
    ),
    duplicate: result.duplicate,
  };
};
