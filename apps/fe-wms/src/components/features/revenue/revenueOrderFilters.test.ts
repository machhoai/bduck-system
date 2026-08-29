import assert from "node:assert/strict";
import test from "node:test";

import {
  emptyRevenueOrderFilters,
  getPaginationPages,
  matchesRevenueOrderFilters,
} from "./revenueOrderFilters.js";

const order = {
  employeeName: "An",
  statusLabel: "PAID",
  payMethod: "Cash",
  amount: 250_000,
  searchable: "POS-001 duck plush",
};

test("filters revenue orders by search, payment and amount", () => {
  assert.equal(
    matchesRevenueOrderFilters(order, {
      ...emptyRevenueOrderFilters,
      search: "duck",
      payment: "Cash",
      minAmount: "200000",
      maxAmount: "300000",
    }),
    true,
  );
  assert.equal(
    matchesRevenueOrderFilters(order, {
      ...emptyRevenueOrderFilters,
      payment: "Transfer",
    }),
    false,
  );
});

test("builds a compact pagination window around the current page", () => {
  assert.deepEqual(getPaginationPages(1, 10), [1, 2, 3]);
  assert.deepEqual(getPaginationPages(5, 10), [4, 5, 6]);
  assert.deepEqual(getPaginationPages(10, 10), [8, 9, 10]);
  assert.deepEqual(getPaginationPages(1, 1), [1]);
});
