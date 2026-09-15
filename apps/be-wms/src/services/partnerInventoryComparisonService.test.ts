import assert from "node:assert/strict";
import test from "node:test";

import type { Inventory, Product } from "@bduck/shared-types";

import {
  aggregatePartnerInventoryAtp,
  buildPartnerInventoryComparisonRow,
} from "./partnerInventoryComparisonPolicy.js";
import type { JoyWorldStockRow } from "./partnerInventorySchemas.js";
import {
  createPartnerInventoryPayloadFingerprint,
  derivePartnerInventoryJobStatus,
} from "./partnerInventorySyncPolicy.js";

const product = (id: string, code: string): Product =>
  ({ id, code, name: `Product ${code}`, category_id: "category-1" }) as Product;

const partner = (giftNo: string, amount: number): JoyWorldStockRow => ({
  id: `stock-value-${giftNo}`,
  stockId: "stock-1",
  stockName: "Main stock",
  giftId: `gift-${giftNo}`,
  giftNo,
  giftName: `Gift ${giftNo}`,
  amount,
  giftPrice: 10,
  isEnabled: true,
  updateTime: "2026-09-15T00:00:00Z",
});

test("aggregates only ATP buckets for the selected warehouse inventory", () => {
  const inventory = [
    { id: "i1", product_id: "p1", atp_quantity: 10, on_hold_quantity: 99 },
    { id: "i2", product_id: "p1", atp_quantity: 15, on_hold_quantity: 50 },
  ] as Inventory[];
  assert.equal(aggregatePartnerInventoryAtp(inventory).get("p1"), 25);
});

test("matches exact SKU and exposes a selectable delta", () => {
  const row = buildPartnerInventoryComparisonRow({
    sku: "0001",
    products: [product("p1", "0001")],
    atpByProduct: new Map([["p1", 25]]),
    partnerRows: [partner("0001", 20)],
  });
  assert.equal(row.status, "READY");
  assert.equal(row.delta, 5);
  assert.equal(row.eligible, true);
});

test("allows target ATP zero when an exact partner SKU exists", () => {
  const row = buildPartnerInventoryComparisonRow({
    sku: "SKU-0",
    products: [product("p0", "SKU-0")],
    atpByProduct: new Map([["p0", 0]]),
    partnerRows: [partner("SKU-0", 8)],
  });
  assert.equal(row.status, "READY");
  assert.equal(row.delta, -8);
  assert.equal(row.eligible, true);
});

test("blocks missing partner matches and duplicate exact SKUs", () => {
  const missing = buildPartnerInventoryComparisonRow({
    sku: "0001",
    products: [product("p1", "0001")],
    atpByProduct: new Map([["p1", 10]]),
    partnerRows: [],
  });
  const duplicate = buildPartnerInventoryComparisonRow({
    sku: "0001",
    products: [product("p1", "0001"), product("p2", "0001")],
    atpByProduct: new Map([["p1", 10], ["p2", 10]]),
    partnerRows: [partner("0001", 10)],
  });
  assert.equal(missing.status, "NO_PARTNER_MATCH");
  assert.equal(missing.eligible, false);
  assert.equal(duplicate.status, "DUPLICATE_SKU");
  assert.equal(duplicate.eligible, false);
});

test("does not normalize a negative ATP into zero", () => {
  const row = buildPartnerInventoryComparisonRow({
    sku: "NEG",
    products: [product("p1", "NEG")],
    atpByProduct: new Map([["p1", -1]]),
    partnerRows: [partner("NEG", 0)],
  });
  assert.equal(row.status, "INVALID_ATP");
  assert.equal(row.jpulse_atp, -1);
  assert.equal(row.eligible, false);
});

test("makes idempotency independent of product selection order", () => {
  const base = {
    snapshot_id: "11111111-1111-4111-8111-111111111111",
    request_id: "22222222-2222-4222-8222-222222222222",
    action_time: "2026-09-15T00:00:00.000Z",
  };
  const left = createPartnerInventoryPayloadFingerprint("warehouse-1", {
    ...base,
    product_ids: ["b", "a", "a"],
  });
  const right = createPartnerInventoryPayloadFingerprint("warehouse-1", {
    ...base,
    product_ids: ["a", "b"],
  });
  assert.equal(left, right);
});

test("keeps an ambiguous partner result in UNKNOWN state", () => {
  const item = {
    product_id: "p1",
    sku: "SKU-1",
    target_atp: 10,
    partner_before: 5,
    partner_after: null,
    delta: 5,
    status: "UNKNOWN" as const,
    message: "PARTNER_RESULT_UNKNOWN",
  };
  assert.equal(derivePartnerInventoryJobStatus([item]), "UNKNOWN");
});
