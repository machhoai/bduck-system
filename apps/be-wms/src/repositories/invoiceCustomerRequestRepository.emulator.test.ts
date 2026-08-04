import assert from "node:assert/strict";
import test from "node:test";
import { InvoiceDocumentStatus } from "@bduck/shared-types";
import type { PosInvoiceOrderRecord } from "./posInvoiceOrderRepository.js";

test(
  "sparse JPOS orders are serialized into Firestore without undefined values",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const [
      { db },
      { invoiceOrderRepository, invoiceSourceOrderDocumentId },
      { buildPosInvoiceSourceOrder },
    ] = await Promise.all([
      import("../config/firebase.js"),
      import("./invoiceOrderRepository.js"),
      import("../services/invoicePosOrderAdapter.js"),
    ]);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const warehouseId = `jpos-source-store-${suffix}`;
    const localOrderId = `ORD-LOCAL-${suffix}`;
    const source = buildPosInvoiceSourceOrder(
      {
        localOrderId,
        hkOrderNumber: null,
        warehouseId,
        status: "LOCAL_PAID",
        totalAmount: 110_000,
        items: [
          {
            goodsId: "duck-001",
            goodsName: "Vịt quay",
            price: 110_000,
            quantity: 1,
          },
        ],
        createdAt: "2026-08-04T03:00:00.000Z",
        paidAt: "2026-08-04T03:30:00.000Z",
      } as PosInvoiceOrderRecord,
      "2026-08-04",
      null,
      null,
    );

    const result = await invoiceOrderRepository.upsertOrders(
      warehouseId,
      `run-${suffix}`,
      [source],
      new Date("2026-08-04T03:31:00.000Z"),
    );
    const documentId = invoiceSourceOrderDocumentId(
      warehouseId,
      localOrderId,
      "JPOS",
    );
    const payload = await db
      .collection("invoice_source_order_payloads")
      .doc(documentId)
      .get();
    const rawOrder = payload.data()?.latest_payload?.pos_order;

    assert.equal(result.inserted_count, 1);
    assert.equal(rawOrder.customerName, null);
    assert.equal(rawOrder.customerPhone, null);
    assert.equal(rawOrder.updatedAt, null);
  },
);

test(
  "customer invoice submission atomically replaces buyer, records history and is idempotent",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const [{ db }, { invoiceCustomerRequestRepository }] = await Promise.all([
      import("../config/firebase.js"),
      import("./invoiceCustomerRequestRepository.js"),
    ]);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const documentId = `customer-request-document-${suffix}`;
    const warehouseId = `customer-request-store-${suffix}`;
    const requestId = `customer-request-${suffix}`;
    const oldBuyer = {
      full_name: "Khách lẻ",
      legal_name: "Khách lẻ",
      tax_code: "",
      address: "",
      phone_number: "",
      email: "",
    };
    const buyer = {
      full_name: "Nguyễn Văn A",
      legal_name: "CÔNG TY TNHH VỊT VÀNG",
      tax_code: "0312345678",
      address: "Thành phố Hồ Chí Minh",
      phone_number: "0901234567",
      email: "invoice@example.com",
    };
    await Promise.all([
      db.collection("invoice_documents").doc(documentId).set({
        id: documentId,
        warehouse_id: warehouseId,
        status: InvoiceDocumentStatus.NEEDS_REVIEW,
        revision: 1,
        issue_eligible: true,
        buyer: oldBuyer,
        is_deleted: false,
        created_at: new Date(),
        updated_at: new Date(),
      }),
      db.collection("invoice_source_orders").doc(documentId).set({
        id: documentId,
        warehouse_id: warehouseId,
        customer_invoice_request_status: "AVAILABLE",
        is_deleted: false,
      }),
    ]);

    const input = {
      requestId,
      invoiceDocumentId: documentId,
      warehouseId,
      localOrderId: "ORD-LOCAL-001",
      hkOrderNumber: "HK-001",
      tokenHash: "token-sha256-only",
      idempotencyKey: "3a73a82f-86a6-4d5f-9281-d2fb812acd81",
      buyer,
      allowedStatuses: [
        InvoiceDocumentStatus.NEEDS_REVIEW,
        InvoiceDocumentStatus.READY_TO_ISSUE,
      ],
      nextReadyStatus: InvoiceDocumentStatus.READY_TO_ISSUE,
      actionTime: new Date("2026-08-04T03:30:00.000Z"),
      syncTime: new Date("2026-08-04T03:30:01.000Z"),
      ipAddress: "127.0.0.1",
      deviceId: "test-device",
    };
    const first = await invoiceCustomerRequestRepository.applyBuyer(input);
    const duplicate = await invoiceCustomerRequestRepository.applyBuyer(input);
    assert.equal(first.duplicate, false);
    assert.equal(duplicate.duplicate, true);

    const [document, source, request, audit, revision] = await Promise.all([
      db.collection("invoice_documents").doc(documentId).get(),
      db.collection("invoice_source_orders").doc(documentId).get(),
      db.collection("invoice_customer_requests").doc(requestId).get(),
      db.collection("audit_logs").doc(requestId).get(),
      db.collection("invoice_documents").doc(documentId)
        .collection("revisions").doc("2").get(),
    ]);
    assert.deepEqual(document.data()?.buyer, buyer);
    assert.equal(document.data()?.revision, 2);
    assert.equal(document.data()?.status, InvoiceDocumentStatus.READY_TO_ISSUE);
    assert.equal(document.data()?.local_order_id, "ORD-LOCAL-001");
    assert.equal(document.data()?.hk_order_number, "HK-001");
    assert.equal(source.data()?.customer_invoice_request_status, "SUBMITTED");
    assert.equal(request.data()?.capability_token_hash, "token-sha256-only");
    assert.equal("capability_token" in (request.data() ?? {}), false);
    assert.deepEqual(audit.data()?.old_value?.buyer, oldBuyer);
    assert.deepEqual(audit.data()?.new_value?.buyer, buyer);
    assert.deepEqual(revision.data()?.buyer, buyer);
  },
);

test(
  "customer invoice submission is rejected once the invoice is locked",
  { skip: !process.env.FIRESTORE_EMULATOR_HOST },
  async () => {
    const [{ db }, { invoiceCustomerRequestRepository }] = await Promise.all([
      import("../config/firebase.js"),
      import("./invoiceCustomerRequestRepository.js"),
    ]);
    const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const documentId = `locked-customer-request-${suffix}`;
    const warehouseId = `locked-customer-store-${suffix}`;
    await Promise.all([
      db.collection("invoice_documents").doc(documentId).set({
        warehouse_id: warehouseId,
        status: InvoiceDocumentStatus.ISSUED,
        revision: 3,
        issue_eligible: true,
        buyer: {},
        is_deleted: false,
      }),
      db.collection("invoice_source_orders").doc(documentId).set({
        warehouse_id: warehouseId,
        is_deleted: false,
      }),
    ]);

    await assert.rejects(
      invoiceCustomerRequestRepository.applyBuyer({
        requestId: `locked-request-${suffix}`,
        invoiceDocumentId: documentId,
        warehouseId,
        localOrderId: "ORD-LOCKED",
        hkOrderNumber: null,
        tokenHash: "locked-token-hash",
        idempotencyKey: "1ad96ab7-4d42-48a6-a6c6-55d810e30628",
        buyer: {
          full_name: "A",
          legal_name: "A",
          tax_code: "0312345678",
          address: "A",
          phone_number: "",
          email: "",
        },
        allowedStatuses: [InvoiceDocumentStatus.NEEDS_REVIEW],
        nextReadyStatus: InvoiceDocumentStatus.READY_TO_ISSUE,
        actionTime: new Date(),
        syncTime: new Date(),
        ipAddress: null,
        deviceId: null,
      }),
      (error: unknown) =>
        (error as { data?: { code?: string } }).data?.code ===
        "INVOICE_REQUEST_LOCKED",
    );
  },
);
