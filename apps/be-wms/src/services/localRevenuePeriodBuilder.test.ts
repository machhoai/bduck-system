import assert from "node:assert/strict";
import test from "node:test";

import ExcelJS from "exceljs";

import type { PosInvoiceOrderRecord } from "../repositories/posInvoiceOrderRepository.js";

import { vietnamDateKey } from "./localRevenueDataUtils.js";
import { buildLocalRevenuePeriod } from "./localRevenuePeriodBuilder.js";
import { buildRevenueDashboard } from "./revenueDashboardBuilder.js";
import { buildRevenueWorkbook } from "./revenueWorkbookService.js";

const range = {
  startDate: "2026-09-06",
  endDate: "2026-09-06",
  label: "06/09/2026",
  highlightedDates: [],
};
const order = (
  warehouseId: string,
  amount: number,
  quantity: number,
): PosInvoiceOrderRecord => ({
  warehouseId,
  localOrderId: "same-local-id",
  hkOrderNumber: null,
  status: "SYNC_SUCCESS",
  totalAmount: amount,
  paymentMethodId: "CASH",
  paidAt: "2026-09-05T17:30:00.000Z",
  createdAt: "2026-09-05T17:00:00.000Z",
  items: [
    {
      goodsId: "ticket",
      goodsName: "Vé",
      categoryName: "Vé vào cửa",
      quantity,
      price: amount / quantity,
    },
  ],
});

test("business dates use Vietnam midnight and a stable ISO key", () => {
  assert.equal(vietnamDateKey("2026-09-05T16:59:59.999Z"), "2026-09-05");
  assert.equal(vietnamDateKey("2026-09-05T17:00:00.000Z"), "2026-09-06");
  assert.equal(vietnamDateKey("invalid"), null);
});

test("all-store aggregation retains matching local IDs, groups products and recalculates percentages", () => {
  const a = order("a", 100_000, 1);
  const b = { ...order("b", 300_000, 3), paymentMethodId: "QR_CODE" };
  const period = buildLocalRevenuePeriod(
    [a, b, a, { ...a, localOrderId: "draft", status: "DRAFT" }],
    range,
  );
  assert.equal(period.dailyRows[0].totalRevenue, 400_000);
  assert.equal(period.dailyRows[0].orderCount, 2);
  assert.equal(period.topProductGroups[0].quantity, 4);
  assert.equal(period.topProductGroups[0].items[0].revenue, 400_000);
  assert.deepEqual(
    period.paymentMethods.map((payment) => payment.percentage),
    [75, 25],
  );
  assert.equal(new Set(period.orders.map((item) => item.orderId)).size, 2);
  assert.equal(new Set(period.soldItems.map((item) => item.id)).size, 2);
});

test("product catalog replaces placeholder groups but preserves meaningful historical groups", () => {
  const placeholder = order("a", 100_000, 1);
  placeholder.items = [
    {
      goodsId: "ticket",
      goodsName: "Vé",
      categoryName: "Other",
      quantity: 1,
      price: 100_000,
    },
  ];
  const catalogResult = buildLocalRevenuePeriod([placeholder], range, {
    ticket: "Vé vào cửa",
  });
  assert.equal(catalogResult.topProductGroups[0].groupName, "Vé vào cửa");
  const explicitResult = buildLocalRevenuePeriod(
    [order("a", 100_000, 1)],
    range,
    { ticket: "Nhóm mới" },
  );
  assert.equal(explicitResult.topProductGroups[0].groupName, "Vé vào cửa");
});

test("selected-day data reaches all sales-composition worksheets with numeric totals", async () => {
  const current = buildLocalRevenuePeriod(
    [order("a", 100_000, 1), order("b", 300_000, 3)],
    range,
  );
  const dashboard = buildRevenueDashboard({
    source: "LOCAL_POS",
    taxSource: "LOCAL_POS",
    warehouseId: "ALL",
    warehouseName: "A, B",
    mode: "date",
    range,
    comparisonRange: range,
    current,
    previous: buildLocalRevenuePeriod([], range),
  });
  assert.equal(dashboard.stats.averageOrderValue.value, 200_000);
  const workbook = new ExcelJS.Workbook();
  const buffer = await buildRevenueWorkbook(
    dashboard,
    "SALES_COMPOSITION",
    "vi",
  );
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  assert.equal(
    workbook.getWorksheet("Tổng quan")?.getCell("B8").value,
    400_000,
  );
  assert.equal(
    workbook.getWorksheet("Theo nhóm sản phẩm")?.getCell("C3").value,
    400_000,
  );
  assert.equal(
    workbook.getWorksheet("Chi tiết sản phẩm")?.getCell("D3").value,
    400_000,
  );
  assert.equal(
    workbook.getWorksheet("Chi tiết sản phẩm")?.getCell("D4").result,
    400_000,
  );
});

test("a day without paid orders stays empty and has no circular total formula", async () => {
  const nextDay = { ...range, startDate: "2026-09-07", endDate: "2026-09-07" };
  const current = buildLocalRevenuePeriod([order("a", 100_000, 1)], nextDay);
  const dashboard = buildRevenueDashboard({
    source: "LOCAL_POS",
    taxSource: "LOCAL_POS",
    warehouseId: "a",
    warehouseName: "A",
    mode: "date",
    range: nextDay,
    comparisonRange: range,
    current,
    previous: buildLocalRevenuePeriod([], range),
  });
  assert.equal(dashboard.stats.totalRevenue.value, 0);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(
    (await buildRevenueWorkbook(
      dashboard,
      "SALES_COMPOSITION",
      "vi",
    )) as unknown as ExcelJS.Buffer,
  );
  assert.equal(
    workbook.getWorksheet("Chi tiết sản phẩm")?.getCell("D3").value,
    0,
  );
  assert.equal(
    workbook.getWorksheet("Chi tiết sản phẩm")?.getCell("D3").formula,
    undefined,
  );
});
