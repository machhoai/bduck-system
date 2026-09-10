import assert from "node:assert/strict";
import test from "node:test";

import {
  getRevenueProductKey,
  type RevenueDashboardData,
  type RevenueMetric,
} from "@bduck/shared-types";
import ExcelJS from "exceljs";

import { buildRevenueWorkbook } from "./revenueWorkbookService.js";

const metric = (value: number): RevenueMetric => ({
  value,
  previousValue: 0,
  changePercent: 0,
});

const rowValues = (
  sheet: ExcelJS.Worksheet | undefined,
  rowNumber: number,
  columnCount: number,
) =>
  Array.from(
    { length: columnCount },
    (_, index) => sheet?.getCell(rowNumber, index + 1).value,
  );

const workbookText = (workbook: ExcelJS.Workbook) => {
  const values: string[] = [];
  workbook.worksheets.forEach((sheet) => {
    sheet.eachRow((row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        values.push(String(cell.value ?? ""));
      });
    });
  });
  return values.join(" ");
};

function dashboard(): RevenueDashboardData {
  const paymentMethods = [
    {
      method: "CASH",
      category: "cash" as const,
      amount: 700_000,
      orderCount: 2,
      percentage: 70,
    },
    {
      method: "VIETQR",
      category: "transfer" as const,
      amount: 300_000,
      orderCount: 1,
      percentage: 30,
    },
  ];
  return {
    source: "OPEN_API",
    taxSource: "LOCAL_POS",
    warehouseId: "store-1",
    warehouseName: "Landmark 81",
    mode: "date",
    cacheKey: "test",
    range: {
      startDate: "2026-08-27",
      endDate: "2026-08-27",
      label: "27/08/2026",
      highlightedDates: [],
    },
    comparisonLabel: "",
    stats: {
      totalRevenue: metric(1_000_000),
      cashRevenue: metric(700_000),
      transferRevenue: metric(300_000),
      otherRevenue: metric(0),
      totalTax: metric(80_000),
      amountBeforeTax: metric(920_000),
      totalOrders: metric(3),
      averageOrderValue: metric(333_333),
      memberCardSales: metric(0),
      deviceConsumption: metric(0),
      memberCount: metric(0),
      memberStoredBalance: metric(0),
      memberGiftBalance: metric(0),
      paymentMethods,
    },
    charts: {
      granularity: "day",
      points: [],
      paymentMethods,
      memberCardSales: [],
    },
    dailyRows: [
      {
        date: "2026-08-27",
        totalRevenue: 1_000_000,
        cashRevenue: 700_000,
        transferRevenue: 300_000,
        otherRevenue: 0,
        totalTax: 80_000,
        amountBeforeTax: 920_000,
        orderCount: 3,
      },
    ],
    topProductGroups: [
      {
        groupName: "Vé",
        quantity: 4,
        revenue: 1_000_000,
        taxAmount: 80_000,
        items: [
          {
            name: "Vé ngày",
            quantity: 4,
            revenue: 1_000_000,
            taxAmount: 80_000,
          },
        ],
      },
    ],
    deviceConsumptions: [],
    orders: [],
    soldItems: [],
    generatedAt: "2026-08-27T05:00:00.000Z",
  };
}

test("daily revenue workbook is a localized, formatted Excel file", async () => {
  const buffer = await buildRevenueWorkbook(dashboard(), "DAILY_REVENUE", "vi");
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["Tổng quan", "Doanh thu từng ngày", "Cơ cấu thanh toán"],
  );
  const daily = workbook.getWorksheet("Doanh thu từng ngày");
  assert.deepEqual(rowValues(daily, 2, 7), [
    "Ngày",
    "Tổng doanh thu",
    "Doanh thu tiền mặt",
    "Doanh thu chuyển khoản",
    "Doanh thu phương thức khác",
    "Số đơn",
    "Giá trị đơn trung bình",
  ]);
  assert.equal(daily?.getCell("B3").value, 1_000_000);
  assert.match(daily?.getCell("B3").numFmt ?? "", /₫/u);
  assert.equal(daily?.getCell("B4").formula, "SUM(B3:B3)");
  assert.equal(daily?.views[0]?.state, "frozen");
  assert.doesNotMatch(workbookText(workbook), /thuế/iu);
});

test("sales composition workbook uses Chinese sheet names and numeric VND cells", async () => {
  const buffer = await buildRevenueWorkbook(
    dashboard(),
    "SALES_COMPOSITION",
    "zh",
  );
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

  assert.deepEqual(
    workbook.worksheets.map((sheet) => sheet.name),
    ["汇总", "按商品组", "商品明细"],
  );
  const products = workbook.getWorksheet("商品明细");
  assert.deepEqual(rowValues(products, 2, 6), [
    "商品组",
    "商品",
    "数量",
    "营收",
    "平均售价",
    "占比",
  ]);
  assert.equal(typeof products?.getCell("D3").value, "number");
  assert.match(products?.getCell("D3").numFmt ?? "", /₫/u);
  assert.doesNotMatch(workbookText(workbook), /税/u);
});

test("product selection excludes other rows and keeps aliases as text", async () => {
  const data = dashboard();
  data.source = "LOCAL_POS";
  data.topProductGroups.push({
    groupName: "Quà tặng",
    quantity: 1,
    revenue: 200_000,
    taxAmount: 10_000,
    items: [
      { name: "Vé ngày", quantity: 1, revenue: 200_000, taxAmount: 10_000 },
    ],
  });
  const buffer = await buildRevenueWorkbook(data, "SALES_COMPOSITION", "vi", {
    products: [
      {
        key: getRevenueProductKey("Quà tặng", "Vé ngày"),
        exportName: '=HYPERLINK("bad")',
      },
    ],
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const products = workbook.getWorksheet("Chi tiết sản phẩm");
  assert.equal(products?.getCell("A3").value, "Quà tặng");
  assert.equal(products?.getCell("B3").value, '=HYPERLINK("bad")');
  assert.equal(products?.getCell("B3").formula, undefined);
  assert.equal(products?.getCell("D3").value, 200_000);
  assert.doesNotMatch(workbookText(workbook), /Vé vào cửa/u);
});

test("invoice preparation preserves recorded tax and selected alias", async () => {
  const data = dashboard();
  data.source = "LOCAL_POS";
  data.soldItems = [
    {
      id: "line-1",
      orderId: "store-1:order-1",
      orderNumber: "HD-001",
      status: 3,
      statusLabel: "PAID",
      createTime: "2026-08-27T03:00:00.000Z",
      employeeName: "Lan",
      payMethod: "CASH",
      goodsName: "Vé ngày",
      goodsTypeName: "Vé",
      categoryName: "Vé",
      price: 250_000,
      qty: 4,
      sysMoney: 1_000_000.4,
      discountMoney: 0,
      realMoney: 1_000_000.4,
      cancelQty: 0,
      cancelMoney: 0,
      taxMoney: 80_000.4,
      warehouseId: "store-1",
      warehouseName: "Landmark 81",
    },
  ];
  const buffer = await buildRevenueWorkbook(data, "INVOICE_PREPARATION", "vi", {
    products: [
      { key: getRevenueProductKey("Vé", "Vé ngày"), exportName: "Vé ngày mới" },
    ],
    roundMoney: true,
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.getWorksheet("Tệp hóa đơn");
  assert.equal(sheet?.getCell("A3").value, "Landmark 81");
  assert.equal(sheet?.getCell("D3").value, "Vé ngày mới");
  assert.equal(sheet?.getCell("I3").value, 80_000);
  assert.equal(sheet?.getCell("H3").value, 920_000);
  assert.equal(sheet?.getCell("J3").value, 1_000_000);
  assert.equal(
    Number(sheet?.getCell("H3").value) + Number(sheet?.getCell("I3").value),
    sheet?.getCell("J3").value,
  );
});
