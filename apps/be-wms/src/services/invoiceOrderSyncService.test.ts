import assert from "node:assert/strict";
import test from "node:test";
import { InvoiceOrderSyncPurpose } from "@bduck/shared-types";
import { invoiceOrderSyncInputSchema } from "./invoiceOrderSyncSchemas.js";
import {
  canonicalJson,
  deriveAmountBeforeTax,
  parseJoyworldDate,
} from "./invoiceOrderSyncUtils.js";

test("canonicalJson is stable when object key order changes", () => {
  const left = canonicalJson({ z: 1, nested: { b: true, a: [2, 1] } });
  const right = canonicalJson({ nested: { a: [2, 1], b: true }, z: 1 });
  assert.equal(left, right);
});

test("JoyWorld local timestamps are interpreted in Vietnam timezone", () => {
  assert.equal(
    parseJoyworldDate("2026-07-19 23:30:00")?.toISOString(),
    "2026-07-19T16:30:00.000Z",
  );
  assert.equal(parseJoyworldDate("not-a-date"), null);
});

test("source order sync input accepts only a real business date", () => {
  const valid = invoiceOrderSyncInputSchema.parse({
    warehouse_id: "warehouse-1",
    business_date: "2026-07-19",
    purpose: InvoiceOrderSyncPurpose.RECONCILIATION,
  });
  assert.equal(valid.business_date, "2026-07-19");
  assert.equal(
    invoiceOrderSyncInputSchema.safeParse({
      warehouse_id: "warehouse-1",
      business_date: "2026-02-30",
      purpose: InvoiceOrderSyncPurpose.ISSUE,
    }).success,
    false,
  );
});

test("amount before tax follows the approved HKAPI formula", () => {
  assert.equal(deriveAmountBeforeTax(117_000, 17_000), 100_000);
  assert.equal(deriveAmountBeforeTax(0, 0), 0);
  assert.equal(deriveAmountBeforeTax(117_000, null), null);
});
