import assert from "node:assert/strict";
import test from "node:test";
import { MeInvoiceApiError } from "../../services/meInvoiceClient.js";
import { toInvoicePreviewErrorResponse } from "./invoicePreviewError.js";

test("invoice preview preserves MISA rate-limit status and bilingual messages", () => {
  const result = toInvoicePreviewErrorResponse(
    new MeInvoiceApiError("MISA meInvoice request failed: HTTP 429", null, 429),
  );

  assert.equal(result.statusCode, 429);
  assert.equal(result.data.code, "MEINVOICE_RATE_LIMITED");
  assert.match(result.messages.vi, /MISA.*giới hạn/u);
  assert.match(result.messages.zh, /MISA.*限制/u);
});

test("invoice preview keeps the existing mapping for other MISA errors", () => {
  const clientError = toInvoicePreviewErrorResponse(
    new MeInvoiceApiError("invalid invoice", "InvalidInvoice", 422),
  );
  const serverError = toInvoicePreviewErrorResponse(
    new MeInvoiceApiError("service unavailable", null, 503),
  );

  assert.equal(clientError.statusCode, 400);
  assert.equal(clientError.data.code, "InvalidInvoice");
  assert.equal(serverError.statusCode, 502);
});
