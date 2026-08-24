import assert from "node:assert/strict";
import test from "node:test";

import {
  InvoiceDocumentStatus,
  InvoiceIssueItemStatus,
  InvoiceOrderMatchStatus,
  MeInvoiceSignType,
  type MeInvoiceStoreConfig,
} from "@bduck/shared-types";

import {
  bulkIssueRunId,
  chunkInvoiceIds,
  summarizeBulkIssue,
} from "./invoiceBulkIssuePolicy.js";
import {
  createInvoiceBulkIssueSchema,
  previewInvoiceBulkIssueSchema,
} from "./invoiceBulkIssueSchemas.js";
import {
  deadlineTerminalInvoiceIssueStatus,
  invoiceIssueBusinessDate,
  invoiceIssueDeadline,
  invoiceIssueDeadlineExpired,
  retryTimeBeforeInvoiceDeadline,
} from "./invoiceIssueDeadline.js";
import {
  classifyInvoiceIssueFailure,
  findInvoiceRetryDuplicate,
  invoiceLaneId,
  isExplicitMisaRejection,
  isUserRetryCandidate,
  issueJobId,
  publishResultConfirmsInvoice,
  sameInvoiceDocumentSet,
  statusIsIssued,
  validateInvoiceIssueCandidate,
} from "./invoiceIssuePolicy.js";
import {
  createInvoiceIssueJobSchema,
  retryInvoiceIssueItemsSchema,
} from "./invoiceIssueSchemas.js";
import {
  invoiceIssueTaskId,
  invoiceTaskScheduleTime,
} from "./invoiceTaskDispatcher.js";
import { MeInvoiceApiError, MeInvoiceClient } from "./meInvoiceClient.js";

const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });

test("publish contract sends SignType and checks every item result", async () => {
  let requestUrl = "";
  const requestBodies: Record<string, unknown>[] = [];
  const client = new MeInvoiceClient(
    "https://developer.misa.vn/apis/itg/meinvoice",
    "client-id",
    async (input, init) => {
      requestUrl = String(input);
      requestBodies.push(
        JSON.parse(String(init?.body)) as Record<string, unknown>,
      );
      return response({
        success: true,
        publishInvoiceResult: JSON.stringify([
          {
            RefID: "ref-1",
            TransactionID: "lookup-1",
            InvNo: "00000123",
            InvCode: "tax-code",
            ErrorCode: "",
          },
          {
            RefID: "ref-2",
            TransactionID: null,
            InvNo: null,
            ErrorCode: "InvalidTaxCode",
          },
        ]),
      });
    },
  );
  const results = await client.publishInvoices("token", MeInvoiceSignType.HSM, [
    { RefID: "ref-1" },
    { RefID: "ref-2" },
  ]);
  assert.equal(requestUrl.endsWith("/invoice/publishing"), true);
  assert.equal(requestBodies[0]?.SignType, MeInvoiceSignType.HSM);
  assert.equal(results[0]?.invoiceNumber, "00000123");
  assert.equal(results[1]?.errorCode, "InvalidTaxCode");
});

test("status contract queries by RefID and decodes string data", async () => {
  let requestUrl = "";
  const client = new MeInvoiceClient(
    "https://developer.misa.vn/apis/itg/meinvoice",
    "client-id",
    async (input) => {
      requestUrl = String(input);
      return response({
        success: true,
        data: JSON.stringify([
          {
            RefID: "ref-1",
            TransactionID: "lookup-1",
            PublishStatus: 1,
            SendTaxStatus: 2,
            IsDelete: false,
          },
        ]),
      });
    },
  );
  const statuses = await client.getInvoiceStatuses("token", {
    refIds: ["ref-1"],
    invoiceWithCode: true,
    invoiceCalculatingMachine: false,
  });
  assert.match(requestUrl, /inputType=2/u);
  assert.equal(statuses[0]?.publishStatus, 1);
  assert.equal(statusIsIssued(statuses[0]!.publishStatus, false), true);
});

test("ambiguous timeout and duplicate RefID never trigger immediate republish", () => {
  const timeout = classifyInvoiceIssueFailure(
    new MeInvoiceApiError("timeout", "TIMEOUT", 504),
    1,
  );
  const duplicate = classifyInvoiceIssueFailure("DuplicateInvoiceRefID", 1);
  assert.equal(timeout.status, InvoiceIssueItemStatus.PENDING_CONFIRMATION);
  assert.equal(duplicate.status, InvoiceIssueItemStatus.PENDING_CONFIRMATION);
});

test("invoice issue deadline is the next Vietnam midnight", () => {
  const deadline = invoiceIssueDeadline("2026-08-24");
  assert.equal(deadline.toISOString(), "2026-08-24T17:00:00.000Z");
  assert.equal(
    invoiceIssueBusinessDate(null, "2026-08-24T16:59:59.999Z"),
    "2026-08-24",
  );
  assert.equal(
    invoiceIssueBusinessDate(null, "2026-08-24T17:00:00.000Z"),
    "2026-08-25",
  );
  assert.equal(
    invoiceIssueDeadlineExpired(
      deadline,
      new Date("2026-08-24T16:59:59.999Z"),
    ),
    false,
  );
  assert.equal(
    invoiceIssueDeadlineExpired(
      deadline,
      new Date("2026-08-24T17:00:00.000Z"),
    ),
    true,
  );
});

test("invoice retries never cross the Vietnam midnight deadline", () => {
  const deadline = invoiceIssueDeadline("2026-08-24");
  assert.equal(
    retryTimeBeforeInvoiceDeadline(
      15_000,
      deadline,
      new Date("2026-08-24T16:59:40.000Z"),
    )?.toISOString(),
    "2026-08-24T16:59:55.000Z",
  );
  assert.equal(
    retryTimeBeforeInvoiceDeadline(
      15_000,
      deadline,
      new Date("2026-08-24T16:59:50.000Z"),
    ),
    null,
  );
  assert.equal(
    deadlineTerminalInvoiceIssueStatus(
      InvoiceIssueItemStatus.RETRYABLE_ERROR,
    ),
    InvoiceIssueItemStatus.CANCELLED,
  );
  assert.equal(
    deadlineTerminalInvoiceIssueStatus(
      InvoiceIssueItemStatus.PENDING_CONFIRMATION,
    ),
    InvoiceIssueItemStatus.MANUAL_RECONCILIATION,
  );
});

test("MISA 429 opens a five-minute cooldown instead of rapid retries", () => {
  const decision = classifyInvoiceIssueFailure(
    new MeInvoiceApiError("rate limited", null, 429),
    1,
  );
  assert.equal(decision.status, InvoiceIssueItemStatus.RETRYABLE_ERROR);
  assert.equal(decision.retryAfterMs, 5 * 60_000);
  assert.equal(decision.cooldownMs, 5 * 60_000);
});

test("a positive MISA publish trace completes without a status poll", () => {
  assert.equal(
    publishResultConfirmsInvoice({
      errorCode: null,
      transactionId: "transaction-1",
    }),
    true,
  );
  assert.equal(
    publishResultConfirmsInvoice({
      errorCode: "InvalidTaxCode",
      transactionId: null,
    }),
    false,
  );
  assert.equal(publishResultConfirmsInvoice({ errorCode: null }), false);
});

test("Cloud Tasks schedule never rounds a retry before next_attempt_at", () => {
  const nextAttemptAt = new Date("2026-08-06T16:16:55.681Z");
  const scheduleTime = invoiceTaskScheduleTime(nextAttemptAt);
  assert.equal(
    new Date(scheduleTime.seconds * 1_000).toISOString(),
    "2026-08-06T16:16:56.000Z",
  );
  assert.ok(scheduleTime.seconds * 1_000 >= nextAttemptAt.getTime());
  assert.ok(scheduleTime.seconds * 1_000 - nextAttemptAt.getTime() < 1_000);
});

test("recovery sweep task IDs bypass completed-task tombstones safely", () => {
  const base = { jobId: "job-1", itemId: "item-1", attempt: 2 };
  const original = invoiceIssueTaskId(base);
  const firstSweep = invoiceIssueTaskId({
    ...base,
    deduplicationKey: "sweep-100",
  });
  const duplicateFirstSweep = invoiceIssueTaskId({
    ...base,
    deduplicationKey: "sweep-100",
  });
  const nextSweep = invoiceIssueTaskId({
    ...base,
    deduplicationKey: "sweep-101",
  });
  assert.notEqual(firstSweep, original);
  assert.equal(firstSweep, duplicateFirstSweep);
  assert.notEqual(nextSweep, firstSweep);
});

test("only explicit per-item MISA rejections are eligible for manual retry", () => {
  const rejected = {
    status: InvoiceIssueItemStatus.MANUAL_RECONCILIATION,
    misa_error_code: "CallSignServiceFail",
    last_error: "MISA item error: CallSignServiceFail",
    transaction_id: null,
    invoice_number: null,
    invoice_code: null,
  };
  assert.equal(isExplicitMisaRejection(rejected), true);
  assert.equal(
    isExplicitMisaRejection({
      ...rejected,
      last_error: "MISA meInvoice request timed out.",
    }),
    false,
  );
  assert.equal(
    isExplicitMisaRejection({ ...rejected, transaction_id: "misa-created" }),
    false,
  );
  assert.equal(
    isExplicitMisaRejection({
      ...rejected,
      last_error: null,
      retry_eligible: true,
    }),
    true,
  );
});

test("issue policy blocks matched and pre-go-live invoices", () => {
  const config = {
    go_live_at: new Date("2026-07-20T00:00:00+07:00"),
    sign_type: MeInvoiceSignType.HSM,
  } as MeInvoiceStoreConfig;
  const issues = validateInvoiceIssueCandidate(
    {
      status: InvoiceDocumentStatus.READY_TO_ISSUE,
      issue_eligible: true,
      calculation: {},
      source_payload_hash: "hash",
      payment_time: "2026-07-19T12:00:00+07:00",
      financially_edited: true,
      edited_by: "accountant-1",
    },
    {
      source_payload_hash: "hash",
      match_status: InvoiceOrderMatchStatus.MATCHED,
    },
    config,
    "accountant-1",
  );
  assert.deepEqual(
    new Set(issues.map((issue) => issue.code)),
    new Set(["SOURCE_ALREADY_INVOICED", "BEFORE_GO_LIVE"]),
  );
});

test("legacy review statuses issue directly without draft approval", () => {
  const config = {
    go_live_at: new Date("2026-07-20T00:00:00+07:00"),
    sign_type: MeInvoiceSignType.HSM,
  } as MeInvoiceStoreConfig;
  const baseDocument = {
    status: InvoiceDocumentStatus.NEEDS_REVIEW,
    issue_eligible: true,
    calculation: {},
    source_payload_hash: "hash",
    payment_time: "2026-07-21T12:00:00+07:00",
  };
  const source = {
    source_payload_hash: "hash",
    match_status: InvoiceOrderMatchStatus.NOT_CHECKED,
  };
  assert.deepEqual(
    validateInvoiceIssueCandidate(baseDocument, source, config, "issuer"),
    [],
  );
  const issues = validateInvoiceIssueCandidate(
    {
      ...baseDocument,
      financially_edited: true,
      edited_by: "issuer",
    },
    source,
    config,
    "issuer",
  );
  assert.deepEqual(issues, []);
});

test("issue policy blocks a draft whose VAT calculation is older than source", () => {
  const normalizedLine = {
    line_number: 1,
    quantity: 1,
    unit_price: 500_000,
    discount_rate: null,
    discount_amount: null,
    vat_rate_name: "10%",
  };
  const issues = validateInvoiceIssueCandidate(
    {
      status: InvoiceDocumentStatus.READY_TO_ISSUE,
      issue_eligible: true,
      source_payload_hash: "same-raw-payload",
      source_financial_fingerprint: "stale-zero-vat-fingerprint",
      calculation: { calculation_hash: "zero-vat" },
      payment_time: "2026-07-21T12:00:00+07:00",
    },
    {
      source_payload_hash: "same-raw-payload",
      normalized_items: [normalizedLine],
      calculation: { calculation_hash: "ten-percent-vat" },
      match_status: InvoiceOrderMatchStatus.NOT_CHECKED,
    },
    {
      go_live_at: new Date("2026-07-20T00:00:00+07:00"),
      sign_type: MeInvoiceSignType.CALCULATING_MACHINE,
    } as MeInvoiceStoreConfig,
    "issuer",
  );
  assert.ok(issues.some((issue) => issue.code === "SOURCE_FINANCIALS_STALE"));
});

test("job and lane keys are deterministic", () => {
  assert.equal(
    issueJobId("w1", "u1", "click-1"),
    issueJobId("w1", "u1", "click-1"),
  );
  assert.equal(invoiceLaneId("a1", "1C26TAA"), invoiceLaneId("a1", "1C26TAA"));
  assert.notEqual(
    invoiceLaneId("a1", "1C26TAA"),
    invoiceLaneId("a2", "1C26TAA"),
  );
  assert.equal(
    sameInvoiceDocumentSet(["draft-2", "draft-1"], ["draft-1", "draft-2"]),
    true,
  );
  assert.equal(sameInvoiceDocumentSet(["draft-1"], ["draft-2"]), false);
});

test("issue API accepts at most 30 unique candidates per request", () => {
  const base = { warehouse_id: "store-1", idempotency_key: "request-123" };
  assert.equal(
    createInvoiceIssueJobSchema.safeParse({
      ...base,
      invoice_document_ids: Array.from(
        { length: 30 },
        (_, index) => `draft-${index}`,
      ),
    }).success,
    true,
  );
  assert.equal(
    createInvoiceIssueJobSchema.safeParse({
      ...base,
      invoice_document_ids: Array.from(
        { length: 31 },
        (_, index) => `draft-${index}`,
      ),
    }).success,
    false,
  );
});

test("bulk stuck retry API requires a business date and OTP", () => {
  const input = {
    warehouse_id: "store-1",
    business_date: "2026-08-24",
    otp: "123456",
  };
  assert.equal(retryInvoiceIssueItemsSchema.safeParse(input).success, true);
  assert.equal(
    retryInvoiceIssueItemsSchema.safeParse({ ...input, otp: "12345x" }).success,
    false,
  );
  assert.equal(
    retryInvoiceIssueItemsSchema.safeParse({
      ...input,
      business_date: "24/08/2026",
    }).success,
    false,
  );
});

test("all stuck issue states are user retry candidates", () => {
  for (const status of [
    InvoiceIssueItemStatus.PENDING_CONFIRMATION,
    InvoiceIssueItemStatus.RETRYABLE_ERROR,
    InvoiceIssueItemStatus.MANUAL_RECONCILIATION,
  ]) {
    assert.equal(isUserRetryCandidate({ status, ref_id: "ref-1" }), true);
  }
  assert.equal(
    isUserRetryCandidate({
      status: InvoiceIssueItemStatus.SUBMITTING,
      ref_id: "ref-1",
    }),
    false,
  );
});

test("duplicate retry check prioritizes RefID and strong business identities", () => {
  const base = {
    refId: "REF-1",
    sourceOrderId: "SOURCE-1",
    orderNumber: "ORDER-1",
    invSeries: "1C26TAA",
    businessDate: "2026-08-24",
    totalAmount: 550_000,
    buyerTaxCode: "0312345678",
    buyerName: "Công ty Joy World",
    sellerShopCode: "LM81",
  };
  const invoice = {
    ref_id: "ref-1",
    transaction_id: "transaction-1",
    inv_series: "1C26TAA",
    invoice_number: "000001",
    invoice_date: "2026-08-24",
    invoice_code: null,
    buyer_name: null,
    buyer_tax_code: "0312345678",
    payment_method_name: null,
    buyer_order_code: "ORDER-1",
    seller_shop_code: "LM81",
    total_amount: 550_000,
    publish_status: 1,
    send_tax_status: 2,
    is_deleted: false,
  };
  assert.equal(findInvoiceRetryDuplicate(base, [invoice])?.reason, "REF_ID");
  assert.equal(
    findInvoiceRetryDuplicate({ ...base, refId: "new-ref" }, [
      { ...invoice, ref_id: "other-ref" },
    ])?.reason,
    "ORDER_CODE",
  );
  assert.equal(
    findInvoiceRetryDuplicate(
      { ...base, refId: "new-ref", orderNumber: "new-order" },
      [
        {
          ...invoice,
          ref_id: "other-ref",
          buyer_order_code: "other-order",
        },
      ],
    )?.reason,
    "BUSINESS_FINGERPRINT",
  );
});

test("bulk issue validates scoped selection, OTP, and partitions MISA jobs", () => {
  const selection = {
    warehouse_id: "store-1",
    business_date: "2026-07-21",
    selection_mode: "SELECTED",
    source_order_ids: ["order-1"],
  };
  assert.equal(
    previewInvoiceBulkIssueSchema.safeParse(selection).success,
    true,
  );
  assert.equal(
    previewInvoiceBulkIssueSchema.safeParse({
      ...selection,
      selection_mode: "ALL",
    }).success,
    false,
  );
  assert.equal(
    createInvoiceBulkIssueSchema.safeParse({
      ...selection,
      otp: "123456",
      idempotency_key: "bulk-request-1",
      config_fingerprint: "a".repeat(64),
      preview_fingerprint: "b".repeat(64),
      action_time: "2026-07-21T10:00:00.000Z",
    }).success,
    true,
  );
  assert.equal(
    createInvoiceBulkIssueSchema.safeParse({
      ...selection,
      otp: "12345$",
      idempotency_key: "bulk-request-1",
      action_time: "2026-07-21T10:00:00.000Z",
    }).success,
    false,
  );
  assert.deepEqual(
    chunkInvoiceIds(
      Array.from({ length: 61 }, (_, index) => `invoice-${index}`),
    ).map((item) => item.length),
    [30, 30, 1],
  );
  assert.equal(
    bulkIssueRunId("store-1", "user-1", "key-1"),
    bulkIssueRunId("store-1", "user-1", "key-1"),
  );
});

test("bulk summary totals VAT, gross amount, lines and product quantity", () => {
  const summary = summarizeBulkIssue(
    2,
    [
      {
        calculation: {
          total_amount_without_vat: 100,
          total_vat_amount: 10,
          total_amount: 110,
        },
        items: [{ quantity: 1.5 }, { quantity: 2 }],
      },
      {
        calculation: {
          total_amount_without_vat: 200,
          total_vat_amount: 16,
          total_amount: 216,
        },
        items: [{ quantity: 3 }],
      },
    ],
    [],
  );
  assert.deepEqual(summary, {
    invoice_count: 2,
    eligible_count: 2,
    excluded_count: 0,
    total_amount_without_vat: 300,
    total_vat_amount: 26,
    total_amount: 326,
    product_line_count: 3,
    product_quantity: 6.5,
  });
});
