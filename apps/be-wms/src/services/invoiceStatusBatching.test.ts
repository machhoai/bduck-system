import assert from "node:assert/strict";
import test from "node:test";

import { planInvoiceStatusBatches } from "./invoiceStatusBatching.js";

test("status sweep batches up to 30 RefIDs for the same MISA contract", () => {
  const batches = planInvoiceStatusBatches(
    Array.from({ length: 65 }, (_, index) => ({
      account_id: "account-1",
      invoice_with_code: true,
      invoice_calculating_machine: true,
      ref_id: `ref-${index}`,
      context: index,
    })),
  );
  assert.deepEqual(
    batches.map((batch) => batch.items.length),
    [30, 30, 5],
  );
});

test("status sweep never mixes accounts or invoice modes", () => {
  const batches = planInvoiceStatusBatches([
    {
      account_id: "a",
      invoice_with_code: true,
      invoice_calculating_machine: true,
      ref_id: "1",
      context: 1,
    },
    {
      account_id: "a",
      invoice_with_code: false,
      invoice_calculating_machine: true,
      ref_id: "2",
      context: 2,
    },
    {
      account_id: "b",
      invoice_with_code: true,
      invoice_calculating_machine: true,
      ref_id: "3",
      context: 3,
    },
  ]);
  assert.equal(batches.length, 3);
});
