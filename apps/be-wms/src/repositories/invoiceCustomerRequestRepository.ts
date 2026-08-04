import { AuditAction, type InvoiceDraftBuyer } from "@bduck/shared-types";
import { db } from "../config/firebase.js";

const documents = db.collection("invoice_documents");
const sourceOrders = db.collection("invoice_source_orders");
const requests = db.collection("invoice_customer_requests");
const auditLogs = db.collection("audit_logs");

const serviceError = (
  statusCode: number,
  vi: string,
  zh: string,
  code: string,
) => ({ statusCode, messages: { vi, zh }, data: { code } });

const revisionSnapshot = (document: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries({
      revision: document.revision,
      status: document.status,
      buyer: document.buyer,
      payment_method_name: document.payment_method_name,
      items: document.items,
      calculation: document.calculation,
      issue_eligible: document.issue_eligible,
      validation_issues: document.validation_issues,
      financially_edited: document.financially_edited,
      source_payload_hash: document.source_payload_hash,
      edited_by: document.edited_by,
      edited_at: document.edited_at,
      reviewed_by: document.reviewed_by,
      reviewed_at: document.reviewed_at,
      review_note: document.review_note,
      rejected_by: document.rejected_by,
      rejected_at: document.rejected_at,
      customer_invoice_request_id: document.customer_invoice_request_id,
      customer_invoice_request_submitted_at:
        document.customer_invoice_request_submitted_at,
      created_at: document.updated_at ?? document.created_at,
    }).filter(([, value]) => value !== undefined),
  );

export interface ApplyCustomerInvoiceBuyerInput {
  requestId: string;
  invoiceDocumentId: string;
  warehouseId: string;
  localOrderId: string;
  hkOrderNumber: string | null;
  tokenHash: string;
  idempotencyKey: string;
  buyer: InvoiceDraftBuyer;
  allowedStatuses: string[];
  nextReadyStatus: string;
  actionTime: Date;
  syncTime: Date;
  ipAddress: string | null;
  deviceId: string | null;
}

export const invoiceCustomerRequestRepository = {
  async applyBuyer(input: ApplyCustomerInvoiceBuyerInput) {
    const documentRef = documents.doc(input.invoiceDocumentId);
    const sourceRef = sourceOrders.doc(input.invoiceDocumentId);
    const requestRef = requests.doc(input.requestId);
    const auditRef = auditLogs.doc(input.requestId);

    return db.runTransaction(async (transaction) => {
      const [requestSnapshot, documentSnapshot, sourceSnapshot] =
        await Promise.all([
          transaction.get(requestRef),
          transaction.get(documentRef),
          transaction.get(sourceRef),
        ]);
      if (requestSnapshot.exists) {
        return {
          duplicate: true,
          document: documentSnapshot.data() as Record<string, unknown>,
          request: requestSnapshot.data() as Record<string, unknown>,
        };
      }
      if (!documentSnapshot.exists || !sourceSnapshot.exists) {
        throw serviceError(
          409,
          "Đơn hàng chưa sẵn sàng để nhận thông tin hóa đơn.",
          "订单尚未准备好接收发票信息。",
          "INVOICE_REQUEST_SOURCE_NOT_READY",
        );
      }
      const current = documentSnapshot.data() as Record<string, unknown>;
      const source = sourceSnapshot.data() as Record<string, unknown>;
      if (
        current.warehouse_id !== input.warehouseId ||
        source.warehouse_id !== input.warehouseId ||
        current.is_deleted === true ||
        source.is_deleted === true
      ) {
        throw serviceError(
          404,
          "Không tìm thấy đơn hàng tương ứng.",
          "找不到对应的订单。",
          "INVOICE_REQUEST_ORDER_NOT_FOUND",
        );
      }
      if (!input.allowedStatuses.includes(String(current.status))) {
        throw serviceError(
          409,
          "Hóa đơn đã được đưa vào xử lý nên không thể thay đổi thông tin người mua.",
          "发票已进入处理流程，无法修改购买方信息。",
          "INVOICE_REQUEST_LOCKED",
        );
      }

      const nextRevision = Number(current.revision ?? 0) + 1;
      const nextStatus =
        current.issue_eligible === true
          ? input.nextReadyStatus
          : String(current.status);
      const next = {
        ...current,
        revision: nextRevision,
        status: nextStatus,
        buyer: input.buyer,
        local_order_id: input.localOrderId,
        hk_order_number: input.hkOrderNumber,
        customer_invoice_request_id: input.requestId,
        customer_invoice_request_submitted_at: input.syncTime,
        edited_by: "public-customer",
        edited_at: input.syncTime,
        updated_by: "public-customer",
        updated_at: input.syncTime,
      };
      transaction.update(documentRef, {
        revision: next.revision,
        status: next.status,
        buyer: next.buyer,
        local_order_id: next.local_order_id,
        hk_order_number: next.hk_order_number,
        customer_invoice_request_id: next.customer_invoice_request_id,
        customer_invoice_request_submitted_at:
          next.customer_invoice_request_submitted_at,
        edited_by: next.edited_by,
        edited_at: next.edited_at,
        updated_by: next.updated_by,
        updated_at: next.updated_at,
      });
      transaction.update(sourceRef, {
        local_order_id: input.localOrderId,
        hk_order_number: input.hkOrderNumber,
        customer_invoice_request_status: "SUBMITTED",
        customer_invoice_request_submitted_at: input.syncTime,
        invoice_document_status: next.status,
        updated_at: input.syncTime,
      });
      transaction.create(
        documentRef.collection("revisions").doc(String(nextRevision)),
        revisionSnapshot(next),
      );
      const request = {
        id: input.requestId,
        invoice_document_id: input.invoiceDocumentId,
        warehouse_id: input.warehouseId,
        local_order_id: input.localOrderId,
        hk_order_number: input.hkOrderNumber,
        capability_token_hash: input.tokenHash,
        idempotency_key: input.idempotencyKey,
        buyer: input.buyer,
        status: "SUBMITTED",
        action_time: input.actionTime,
        sync_time: input.syncTime,
        is_deleted: false,
        created_at: input.syncTime,
        updated_at: input.syncTime,
      };
      transaction.create(requestRef, request);
      transaction.create(auditRef, {
        id: input.requestId,
        entity_type: "INVOICE_DOCUMENT",
        entity_id: input.invoiceDocumentId,
        warehouse_id: input.warehouseId,
        action: AuditAction.UPDATE,
        user_id: "public-customer",
        user_name: "Khách hàng qua QR",
        entity_name: input.hkOrderNumber ?? input.localOrderId,
        action_time: input.actionTime,
        sync_time: input.syncTime,
        old_value: { buyer: current.buyer, revision: current.revision },
        new_value: { buyer: input.buyer, revision: nextRevision },
        ip_address: input.ipAddress,
        device_id: input.deviceId,
        session_token: null,
        notes: "Customer invoice information submitted from public QR link",
      });
      return { duplicate: false, document: next, request };
    });
  },
};
