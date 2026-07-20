import assert from "node:assert/strict";
import test from "node:test";
import {
  InvoiceDocumentStatus,
  InvoiceIssueItemStatus,
  InvoiceOrderMatchStatus,
  MeInvoiceSignType,
  type MeInvoiceStoreConfig,
} from "@bduck/shared-types";
import { MeInvoiceApiError, MeInvoiceClient } from "./meInvoiceClient.js";
import {
  classifyInvoiceIssueFailure,
  invoiceLaneId,
  issueJobId,
  sameInvoiceDocumentSet,
  statusIsIssued,
  validateInvoiceIssueCandidate,
} from "./invoiceIssuePolicy.js";
import { createInvoiceIssueJobSchema } from "./invoiceIssueSchemas.js";

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
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
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
          { RefID: "ref-1", TransactionID: "lookup-1", PublishStatus: 1, SendTaxStatus: 2, IsDelete: false },
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

test("issue policy blocks historical, already matched and self-issued financial edits", () => {
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
    new Set(["SOURCE_ALREADY_INVOICED", "SEGREGATION_OF_DUTIES", "BEFORE_GO_LIVE"]),
  );
});

test("job and lane keys are deterministic", () => {
  assert.equal(issueJobId("w1", "u1", "click-1"), issueJobId("w1", "u1", "click-1"));
  assert.equal(invoiceLaneId("a1", "1C26TAA"), invoiceLaneId("a1", "1C26TAA"));
  assert.notEqual(invoiceLaneId("a1", "1C26TAA"), invoiceLaneId("a2", "1C26TAA"));
  assert.equal(sameInvoiceDocumentSet(["draft-2", "draft-1"], ["draft-1", "draft-2"]), true);
  assert.equal(sameInvoiceDocumentSet(["draft-1"], ["draft-2"]), false);
});

test("issue API accepts at most 30 unique candidates per request", () => {
  const base = { warehouse_id: "store-1", idempotency_key: "request-123" };
  assert.equal(
    createInvoiceIssueJobSchema.safeParse({
      ...base,
      invoice_document_ids: Array.from({ length: 30 }, (_, index) => `draft-${index}`),
    }).success,
    true,
  );
  assert.equal(
    createInvoiceIssueJobSchema.safeParse({
      ...base,
      invoice_document_ids: Array.from({ length: 31 }, (_, index) => `draft-${index}`),
    }).success,
    false,
  );
});
