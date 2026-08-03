import assert from "node:assert/strict";
import test from "node:test";

import {
  LocationStatus,
  type Product,
  type WarehouseLocation,
} from "@bduck/shared-types";
import ExcelJS from "exceljs";

import { parseVoucherRows } from "./voucherExcelImport";
import { buildVoucherExcelTemplate } from "./voucherExcelTemplate";

const products = [
  {
    id: "product-1",
    code: "SKU-001",
    name: "Sản phẩm A",
    unit: "Cái",
    unit_price: 100,
    is_deleted: false,
  },
] as Product[];

const location = (
  id: string,
  warehouseId: string,
  code: string,
): WarehouseLocation =>
  ({
    id,
    warehouse_id: warehouseId,
    code,
    name: code,
    status: LocationStatus.ACTIVE,
    is_deleted: false,
  }) as WarehouseLocation;

test("transfer template contains required source and destination locations", async () => {
  const workbook = buildVoucherExcelTemplate({
    products,
    locations: [location("source-1", "warehouse-source", "SRC-01")],
    destinationLocations: [
      location("destination-1", "warehouse-destination", "DST-01"),
    ],
    language: "vi",
  });
  const sheet = workbook.getWorksheet("Nhap_san_pham");

  assert.ok(sheet);
  const headerValues = sheet.getRow(1).values;
  assert.ok(Array.isArray(headerValues));
  assert.deepEqual(headerValues.slice(1), [
    "SKU / Mã sản phẩm *",
    "Tên sản phẩm *",
    "Số lượng *",
    "Đơn giá",
    "Vị trí nguồn *",
    "Vị trí đích *",
    "Ghi chú",
  ]);
  assert.equal(sheet.getCell("E2").dataValidation.allowBlank, false);
  assert.deepEqual(sheet.getCell("E2").dataValidation.formulae, [
    "VoucherLocationCodes",
  ]);
  assert.equal(sheet.getCell("F2").dataValidation.allowBlank, false);
  assert.deepEqual(sheet.getCell("F2").dataValidation.formulae, [
    "VoucherDestinationLocationCodes",
  ]);

  const buffer = await workbook.xlsx.writeBuffer();
  assert.ok(buffer.byteLength > 0);
});

test("transfer import reads both location columns and rejects a missing destination", async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Data");
  sheet.addRow(["Tên sản phẩm", "Số lượng", "Vị trí nguồn", "Vị trí đích"]);
  sheet.addRow(["Sản phẩm A", 2, "SRC-01", "DST-01"]);
  sheet.addRow(["Sản phẩm A", 1, "SRC-02", ""]);
  const buffer = await workbook.xlsx.writeBuffer();
  const file = new File([buffer], "transfer.xlsx");

  const rows = await parseVoucherRows(
    file,
    0,
    {
      productName: "A",
      sku: null,
      quantity: "B",
      unitPrice: null,
      notes: null,
      location: "C",
      destinationLocation: "D",
    },
    2,
    products,
    {
      requireSourceLocation: true,
      requireDestinationLocation: true,
    },
  );

  assert.equal(rows[0].parsedLocationCode, "SRC-01");
  assert.equal(rows[0].parsedDestinationLocationCode, "DST-01");
  assert.deepEqual(rows[0].errors, []);
  assert.ok(rows[1].errors.includes("Thiếu Vị trí đích."));
});
