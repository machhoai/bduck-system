import assert from "node:assert/strict";
import test from "node:test";

import {
  getNetShopRevenue,
  getShopRefundMoney,
} from "./revenueNetCalculation.js";

test("reads net revenue after refund from the shop summary", () => {
  const summary = {
    data: {
      totalMoney: 3_065_000,
      shopRealMoney: 3_065_000,
      refundMoney: 350_000,
    },
  };

  const netRevenue = getNetShopRevenue(summary);
  const refundMoney = getShopRefundMoney(summary);

  assert.equal(netRevenue, 3_065_000);
  assert.equal(refundMoney, 350_000);
  assert.equal((netRevenue ?? 0) + refundMoney, 3_415_000);
});

test("prefers shopRealMoney and preserves a valid zero", () => {
  assert.equal(
    getNetShopRevenue({
      data: { shopRealMoney: "0.00", totalMoney: "100000" },
    }),
    0,
  );
});

test("supports array responses and reports missing revenue", () => {
  assert.equal(
    getNetShopRevenue({ data: [{ totalMoney: "3065000.00" }] }),
    3_065_000,
  );
  assert.equal(getNetShopRevenue({ data: { refundMoney: 350_000 } }), null);
});
