import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregatePosRevenueStats,
  buildPosRevenueDashboardData,
  toVietnamIsoRange,
} from "./posRevenueStats.js";

test("JPOS revenue stats include paid orders and de-duplicate local ids", () => {
  const result = aggregatePosRevenueStats([
    { id: "1", localOrderId: "order-1", status: "SYNC_SUCCESS", totalAmount: 120_000 },
    { id: "2", localOrderId: "order-2", status: "LOCAL_PAID", totalAmount: 80_000 },
    { id: "3", localOrderId: "order-1", status: "SYNC_SUCCESS", totalAmount: 120_000 },
    { id: "4", localOrderId: "draft", status: "DRAFT", totalAmount: 500_000 },
  ]);

  assert.deepEqual(result, {
    totalRevenue: 200_000,
    totalOrders: 2,
    averageOrderValue: 100_000,
  });
});

test("all-store revenue keeps equal local order ids from different warehouses", () => {
  const result = aggregatePosRevenueStats([
    {
      id: "lm-document",
      warehouseId: "lm81",
      localOrderId: "order-1",
      status: "SYNC_SUCCESS",
      totalAmount: 120_000,
    },
    {
      id: "aeon-document",
      warehouseId: "aeon",
      localOrderId: "order-1",
      status: "SYNC_SUCCESS",
      totalAmount: 80_000,
    },
  ]);

  assert.deepEqual(result, {
    totalRevenue: 200_000,
    totalOrders: 2,
    averageOrderValue: 100_000,
  });
});

test("JPOS revenue stats ignore invalid totals", () => {
  assert.deepEqual(
    aggregatePosRevenueStats([
      { id: "1", status: "SYNC_SUCCESS", totalAmount: "invalid" },
    ]),
    { totalRevenue: 0, totalOrders: 0, averageOrderValue: 0 },
  );
});

test("dashboard date bounds follow Vietnam time and use an exclusive end", () => {
  assert.deepEqual(
    toVietnamIsoRange({ startDate: "2025-12-10", endDate: "2025-12-10" }),
    {
      startIso: "2025-12-09T17:00:00.000Z",
      endExclusiveIso: "2025-12-10T17:00:00.000Z",
    },
  );
});

test("JPOS orders feed the legacy dashboard charts, payments and products", () => {
  const dashboard = buildPosRevenueDashboardData({
    records: [
      {
        id: "order-1",
        status: "LOCAL_PAID",
        totalAmount: 150_000,
        paidAt: "2026-08-13T03:00:00.000Z",
        paymentMethodId: "QR_CODE",
        items: [
          {
            goodsName: "Vịt quay",
            categoryName: "Ẩm thực",
            quantity: 2,
            price: 75_000,
            taxAmount: 12_000,
          },
        ],
      },
    ],
    warehouseId: "store-1",
    filter: {
      mode: "date",
      date: "2026-08-13",
      month: "2026-08",
      year: "2026",
      startDate: "2026-08-13",
      endDate: "2026-08-13",
    },
    range: { startDate: "2026-08-13", endDate: "2026-08-13" },
    generatedAt: "2026-08-13T04:00:00.000Z",
  });

  assert.equal(dashboard.stats.totalRevenue.value, 150_000);
  assert.equal(dashboard.stats.totalOrders.value, 1);
  assert.equal(dashboard.stats.transferRevenue.value, 150_000);
  assert.equal(dashboard.stats.totalTax.value, 12_000);
  assert.equal(dashboard.stats.amountBeforeTax.value, 138_000);
  assert.equal(dashboard.dailyRows[0]?.transferRevenue, 150_000);
  assert.equal(dashboard.charts.paymentMethods[0]?.method, "QR_CODE");
  assert.equal(dashboard.charts.points[0]?.key, "2026-08-13");
  assert.deepEqual(dashboard.topProductGroups[0]?.items[0], {
    name: "Vịt quay",
    quantity: 2,
    revenue: 150_000,
    taxAmount: 12_000,
  });
});

test("JPOS dashboard fills missing dates so range charts keep every column", () => {
  const dashboard = buildPosRevenueDashboardData({
    records: [
      {
        id: "order-1",
        status: "LOCAL_PAID",
        totalAmount: 150_000,
        paidAt: "2026-08-13T03:00:00.000Z",
      },
    ],
    warehouseId: "store-1",
    filter: {
      mode: "custom",
      date: "2026-08-13",
      month: "2026-08",
      year: "2026",
      startDate: "2026-08-10",
      endDate: "2026-08-16",
    },
    range: { startDate: "2026-08-10", endDate: "2026-08-16" },
    generatedAt: "2026-08-13T04:00:00.000Z",
  });

  assert.equal(dashboard.charts.points.length, 7);
  assert.deepEqual(
    dashboard.charts.points.map((point) => [point.key, point.revenue]),
    [
      ["2026-08-10", 0],
      ["2026-08-11", 0],
      ["2026-08-12", 0],
      ["2026-08-13", 150_000],
      ["2026-08-14", 0],
      ["2026-08-15", 0],
      ["2026-08-16", 0],
    ],
  );
});
