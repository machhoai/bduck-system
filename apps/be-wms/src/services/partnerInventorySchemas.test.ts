import assert from "node:assert/strict";
import test from "node:test";

import {
  createSyncJobSchema,
  joyWorldStockRowSchema,
  saveWarehouseMappingSchema,
} from "./partnerInventorySchemas.js";

test("accepts the observed JoyWorld stock shape", () => {
  const value = joyWorldStockRowSchema.parse({
    id: "stock-value-1",
    stockId: "stock-1",
    stockName: "Main stock",
    giftId: "gift-1",
    giftName: "Gift 1",
    giftNo: "0001",
    amount: 12,
    giftPrice: 1.5,
  });
  assert.equal(value.giftNo, "0001");
  assert.equal(value.amount, 12);
});

test("rejects unsafe free-form mapping identifiers", () => {
  assert.throws(() => saveWarehouseMappingSchema.parse({ partner_stock_id: "$bad" }));
  assert.throws(() => saveWarehouseMappingSchema.parse({ partner_stock_id: " stock-1" }));
});

test("bounds a sync request and requires UUID identifiers", () => {
  const valid = {
    snapshot_id: "11111111-1111-4111-8111-111111111111",
    product_ids: ["22222222-2222-4222-8222-222222222222"],
    request_id: "33333333-3333-4333-8333-333333333333",
    action_time: "2026-09-15T00:00:00.000Z",
  };
  assert.equal(createSyncJobSchema.parse(valid).product_ids.length, 1);
  assert.throws(() => createSyncJobSchema.parse({ ...valid, product_ids: [] }));
  assert.throws(() => createSyncJobSchema.parse({ ...valid, request_id: "retry-1" }));
});
