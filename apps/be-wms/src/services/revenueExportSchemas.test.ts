import assert from "node:assert/strict";
import test from "node:test";
import { exportRevenueSchema } from "./revenueExportSchemas.js";

const request = {
  source: "LOCAL_POS",
  reportType: "SALES_COMPOSITION",
  warehouseId: "store-1",
  locale: "vi",
  actionTime: "2026-09-07T00:00:00.000Z",
  mode: "date",
  date: "2026-09-06",
  month: "2026-09",
  year: "2026",
  startDate: "2026-09-06",
  endDate: "2026-09-06",
};

test("export request restricts invoice source and report-specific options", () => {
  assert.equal(
    exportRevenueSchema.safeParse({
      ...request,
      source: "OPEN_API",
      reportType: "INVOICE_PREPARATION",
    }).success,
    false,
  );
  assert.equal(
    exportRevenueSchema.safeParse({
      ...request,
      reportType: "DAILY_REVENUE",
      products: [{ key: "x" }],
    }).success,
    false,
  );
  assert.equal(
    exportRevenueSchema.safeParse({ ...request, roundMoney: true }).success,
    false,
  );
  assert.equal(
    exportRevenueSchema.safeParse({
      ...request,
      reportType: "INVOICE_PREPARATION",
      roundMoney: true,
      products: [{ key: "x", exportName: "Tên" }],
    }).success,
    true,
  );
});
