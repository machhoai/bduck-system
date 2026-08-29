import type { RevenueDashboardData, RevenueMetric } from "@bduck/shared-types";
import assert from "node:assert/strict";
import test from "node:test";
import ExcelJS from "exceljs";

import { buildRevenueWorkbook } from "./revenueWorkbookService.js";

const metric = (value: number): RevenueMetric => ({ value, previousValue: 0, changePercent: 0 });

function dashboard(): RevenueDashboardData {
  const paymentMethods = [
    { method: "CASH", category: "cash" as const, amount: 700_000, orderCount: 2, percentage: 70 },
    { method: "VIETQR", category: "transfer" as const, amount: 300_000, orderCount: 1, percentage: 30 },
  ];
  return {
    source: "OPEN_API",
    taxSource: "LOCAL_POS",
    warehouseId: "store-1",
    warehouseName: "Landmark 81",
    mode: "date",
    cacheKey: "test",
    range: { startDate: "2026-08-27", endDate: "2026-08-27", label: "27/08/2026", highlightedDates: [] },
    comparisonLabel: "",
    stats: {
      totalRevenue: metric(1_000_000), cashRevenue: metric(700_000),
      transferRevenue: metric(300_000), otherRevenue: metric(0), totalTax: metric(80_000),
      amountBeforeTax: metric(920_000), totalOrders: metric(3), averageOrderValue: metric(333_333),
      memberCardSales: metric(0), deviceConsumption: metric(0), memberCount: metric(0),
      memberStoredBalance: metric(0), memberGiftBalance: metric(0), paymentMethods,
    },
    charts: { granularity: "day", points: [], paymentMethods, memberCardSales: [] },
    dailyRows: [{
      date: "2026-08-27", totalRevenue: 1_000_000, cashRevenue: 700_000,
      transferRevenue: 300_000, otherRevenue: 0, totalTax: 80_000,
      amountBeforeTax: 920_000, orderCount: 3,
    }],
    topProductGroups: [{
      groupName: "Vé", quantity: 4, revenue: 1_000_000, taxAmount: 80_000,
      items: [{ name: "Vé ngày", quantity: 4, revenue: 1_000_000, taxAmount: 80_000 }],
    }],
    deviceConsumptions: [], orders: [], soldItems: [], generatedAt: "2026-08-27T05:00:00.000Z",
  };
}

test("daily revenue workbook is a localized, formatted Excel file", async () => {
  const buffer = await buildRevenueWorkbook(dashboard(), "DAILY_REVENUE", "vi");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), [
    "Tổng quan", "Doanh thu từng ngày", "Cơ cấu thanh toán",
  ]);
  const daily = workbook.getWorksheet("Doanh thu từng ngày");
  assert.equal(daily?.getCell("B3").value, 1_000_000);
  assert.match(daily?.getCell("B3").numFmt ?? "", /₫/u);
  assert.equal(daily?.getCell("B4").formula, "SUM(B3:B3)");
  assert.equal(daily?.views[0]?.state, "frozen");
});

test("sales composition workbook uses Chinese sheet names and numeric VND cells", async () => {
  const buffer = await buildRevenueWorkbook(dashboard(), "SALES_COMPOSITION", "zh");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["汇总", "按商品组", "商品明细"]);
  const products = workbook.getWorksheet("商品明细");
  assert.equal(typeof products?.getCell("D3").value, "number");
  assert.match(products?.getCell("D3").numFmt ?? "", /₫/u);
});
