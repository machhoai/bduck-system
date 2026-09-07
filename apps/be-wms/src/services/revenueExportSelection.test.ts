import assert from "node:assert/strict";
import test from "node:test";
import {
  getRevenueProductKey,
  type RevenueDashboardData,
} from "@bduck/shared-types";
import { applyRevenueProductSelection } from "./revenueExportSelection.js";

const data = {
  topProductGroups: ["A", "B"].map((groupName, index) => ({
    groupName,
    quantity: 1,
    revenue: (index + 1) * 100,
    taxAmount: 10,
    items: [
      {
        name: "Trùng tên",
        quantity: 1,
        revenue: (index + 1) * 100,
        taxAmount: 10,
      },
    ],
  })),
  soldItems: ["A", "B"].map((categoryName, index) => ({
    id: String(index),
    orderId: String(index),
    orderNumber: String(index),
    status: 3,
    statusLabel: "PAID",
    createTime: "2026-01-01T00:00:00Z",
    employeeName: "A",
    payMethod: "CASH",
    goodsName: "Trùng tên",
    goodsTypeName: categoryName,
    categoryName,
    price: 100,
    qty: 1,
    sysMoney: 100,
    discountMoney: 0,
    realMoney: 100,
    cancelQty: 0,
    cancelMoney: 0,
    taxMoney: 10,
  })),
  orders: [{ orderId: "0" }, { orderId: "1" }],
} as unknown as RevenueDashboardData;

test("selection identity includes group and alias does not merge products", () => {
  const result = applyRevenueProductSelection(data, [
    { key: getRevenueProductKey("A", "Trùng tên"), exportName: "Tên mới" },
    { key: getRevenueProductKey("B", "Trùng tên"), exportName: "Tên mới" },
  ]);
  assert.equal(result.topProductGroups.length, 2);
  assert.deepEqual(
    result.topProductGroups.map((group) => group.items[0].name),
    ["Tên mới", "Tên mới"],
  );
  assert.equal(result.soldItems.length, 2);
});

test("selection rejects empty, duplicate and stale keys", () => {
  assert.throws(
    () => applyRevenueProductSelection(data, []),
    /INVALID_REVENUE_PRODUCT_SELECTION/u,
  );
  const key = getRevenueProductKey("A", "Trùng tên");
  assert.throws(
    () => applyRevenueProductSelection(data, [{ key }, { key }]),
    /INVALID_REVENUE_PRODUCT_SELECTION/u,
  );
  assert.throws(
    () => applyRevenueProductSelection(data, [{ key: "missing" }]),
    /INVALID_REVENUE_PRODUCT_SELECTION/u,
  );
});
