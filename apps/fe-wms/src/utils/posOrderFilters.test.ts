import assert from "node:assert/strict";
import test from "node:test";

import type { PosOrderSummary } from "@bduck/shared-types";

import {
  DEFAULT_POS_ORDER_FILTERS,
  filterPosOrders,
} from "./posOrderFilters.js";

const order = (value: Partial<PosOrderSummary>): PosOrderSummary => ({
  id: "1",
  localOrderId: "ORD-1",
  warehouseId: "store-1",
  source: "JPOS",
  legacyStatus: "SYNC_SUCCESS",
  paymentStatus: "PAID",
  syncStatus: "SYNC_SUCCESS",
  hkOrderNumber: "O-1",
  remoteOrderId: null,
  customerName: null,
  customerPhone: "0908350370",
  normalizedPhone: "0908350370",
  operatorId: "e1",
  operatorName: "An",
  productNames: ["Vé lượt"],
  items: [],
  totalAmount: 100,
  createdAt: "2026-09-08T00:00:00.000Z",
  paidAt: null,
  cancelledAt: null,
  version: 0,
  ...value,
});

test("filters independently by payment and synchronization status", () => {
  const values = [
    order({ id: "1", paymentStatus: "PAID", syncStatus: "SYNC_FAILED" }),
    order({ id: "2", paymentStatus: "REFUNDED", syncStatus: "CANCELLED" }),
  ];
  assert.deepEqual(
    filterPosOrders(values, {
      ...DEFAULT_POS_ORDER_FILTERS,
      paymentStatus: "PAID",
      syncStatus: "SYNC_FAILED",
    }).map((item) => item.id),
    ["1"],
  );
});

test("matches order, phone, employee product and amount sorting", () => {
  const values = [
    order({ id: "1", totalAmount: 100 }),
    order({
      id: "2",
      localOrderId: "ORD-2",
      operatorId: "e2",
      totalAmount: 200,
    }),
  ];
  assert.deepEqual(
    filterPosOrders(values, {
      ...DEFAULT_POS_ORDER_FILTERS,
      phone: "350 370",
      product: "vé",
      sortBy: "totalAmount",
      sortDir: "desc",
    }).map((item) => item.id),
    ["2", "1"],
  );
});
