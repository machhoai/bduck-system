import assert from "node:assert/strict";
import test from "node:test";

import {
  deduplicateSourceOrderWrites,
  invoiceSourceOrderDocumentId,
} from "./invoiceOrderIdentity.js";

test("source order identity is scoped by warehouse and source system", () => {
  const tanPhu = invoiceSourceOrderDocumentId("tan-phu", "order-1", "JPOS");
  assert.notEqual(
    tanPhu,
    invoiceSourceOrderDocumentId("landmark", "order-1", "JPOS"),
  );
  assert.notEqual(
    tanPhu,
    invoiceSourceOrderDocumentId("tan-phu", "order-1", "JOYWORLD"),
  );
});

test("duplicate rows in one sync are collapsed within their scoped identity", () => {
  const values = [
    {
      source_order_id: "order-1",
      projection: { source_system: "JPOS" },
      version: 1,
    },
    {
      source_order_id: "order-1",
      projection: { source_system: "JPOS" },
      version: 2,
    },
    {
      source_order_id: "order-1",
      projection: { source_system: "JOYWORLD" },
      version: 3,
    },
  ];
  const result = deduplicateSourceOrderWrites(values);
  assert.deepEqual(
    result.map((item) => item.version),
    [2, 3],
  );
});
