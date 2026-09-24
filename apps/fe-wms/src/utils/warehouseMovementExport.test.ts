import assert from "node:assert/strict";
import test from "node:test";

import {
  TransferOrderStatus,
  TransferType,
  ExportVoucherStatus,
  LocationType,
  type ExportVoucher,
  type ExportVoucherItem,
  type Inventory,
  type TransferOrder,
  type TransferOrderItem,
  type WarehouseLocation,
} from "@bduck/shared-types";
import ExcelJS from "exceljs";


import { buildExportWorkbook } from "./exportExcel.js";
import { buildWarehouseMovementExportConfig } from "./warehouseMovementExport.js";

const warehouseId = "aeon";
const productId = "duck";
const receivedAt = new Date("2026-08-28T11:27:44.000Z");

const transfer = {
  id: "transfer-1",
  order_number: "TRF-X-20260828-275",
  transfer_type: TransferType.INTER_WAREHOUSE,
  source_warehouse_id: "main",
  destination_warehouse_id: warehouseId,
  status: TransferOrderStatus.COMPLETED,
  received_at: receivedAt,
  updated_at: receivedAt,
  is_deleted: false,
} as TransferOrder;

const transferItem = {
  id: "item-1",
  product_id: productId,
  source_location_id: "main-shelf",
  destination_location_id: "aeon-shelf",
  quantity: 25,
  received_quantity: 25,
  is_deleted: false,
} as TransferOrderItem;

function context() {
  return {
    warehouseId,
    warehouseName: "AEON Tân Phú",
    inventory: [{
      id: "stock-1",
      warehouse_id: warehouseId,
      warehouse_location_id: "aeon-shelf",
      product_id: productId,
      total_quantity: 20,
      is_deleted: false,
    } as Inventory],
    products: [],
    categories: [],
    locations: [] as WarehouseLocation[],
    importVouchers: [],
    exportVouchers: [{
      id: "export-1",
      voucher_number: "EXP-20260903-0001",
      warehouse_id: warehouseId,
      status: ExportVoucherStatus.COMPLETED,
      updated_at: new Date("2026-09-03T08:00:00.000Z"),
    } as ExportVoucher],
    transferOrders: [transfer],
    canViewPrice: false,
    itemReaders: {
      imports: async (_id: string) => [],
      exports: async (_id: string) => [{
        id: "export-item-1",
        product_id: productId,
        warehouse_location_id: "aeon-shelf",
        picked_quantity: 5,
        is_deleted: false,
      } as ExportVoucherItem],
      transfers: async (_id: string) => [transferItem],
    },
  };
}

test("August movement includes received inter-warehouse transfer and opening balance", async () => {
  const report = await buildWarehouseMovementExportConfig(context(), {
    dataKind: "movement",
    dateMode: "month",
    month: "2026-08",
  });

  assert.equal(report.data.length, 1);
  assert.equal(report.data[0].import_quantity, 25);
  assert.equal(report.data[0].import_vouchers, transfer.order_number);
  assert.equal(report.data[0].opening_quantity, 0);
  assert.equal(report.data[0].ending_quantity, 25);
  assert.equal(report.reportPeriod, "01/08/2026 đến 31/08/2026");
  const sheet = buildExportWorkbook(report).getWorksheet("Data");
  assert.equal(sheet?.getCell("A1").value, "XUẤT NHẬP TỒN");
  assert.equal(sheet?.getCell("A4").value, "Ngày");
  assert.equal(sheet?.getCell("A5").value, "2026-08-28");
});

test("daily summary starts at selected period opening and includes transfer products", async () => {
  const report = await buildWarehouseMovementExportConfig(context(), {
    dataKind: "dailySummary",
    dateMode: "range",
    dateFrom: "2026-08-28",
    dateTo: "2026-08-29",
  });

  assert.equal(report.data.length, 1);
  assert.equal(report.data[0]["2026-08-28_import"], 25);
  assert.equal(report.data[0].opening_quantity, 0);
  assert.equal(report.data[0].total_ending_quantity, 25);
});

test("Excel worksheet shows report name and selected dates above grouped columns", async () => {
  const report = await buildWarehouseMovementExportConfig(context(), {
    dataKind: "dailySummary",
    dateMode: "range",
    dateFrom: "2026-08-28",
    dateTo: "2026-08-29",
  });
  const workbook = buildExportWorkbook(report);
  const sheet = workbook.getWorksheet("Data");
  assert.ok(sheet);
  assert.equal(sheet.getCell("A1").value, "XUẤT NHẬP TỒN THEO NGÀY");
  assert.equal(sheet.getCell("A2").value, "Kho: AEON Tân Phú");
  assert.equal(sheet.getCell("A3").value, "Phạm vi dữ liệu: 28/08/2026 đến 29/08/2026");
  assert.equal(sheet.getRow(6).getCell(1).value, productId);
  const bytes = await workbook.xlsx.writeBuffer();
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(bytes as unknown as Parameters<typeof reopened.xlsx.load>[0]);
  assert.equal(reopened.getWorksheet("Data")?.getCell("A3").value, "Phạm vi dữ liệu: 28/08/2026 đến 29/08/2026");
});

test("internal transfer changes counter stock without inflating whole-warehouse imports", async () => {
  const intra = {
    ...transfer,
    id: "intra-1",
    order_number: "TRF-I-20260828-586",
    transfer_type: TransferType.INTRA_WAREHOUSE,
    source_warehouse_id: warehouseId,
  } as TransferOrder;
  const scoped = context();
  scoped.transferOrders.push(intra);
  scoped.inventory[0].total_quantity = 13;
  scoped.inventory.push({
    id: "counter-stock",
    warehouse_id: warehouseId,
    warehouse_location_id: "counter",
    product_id: productId,
    total_quantity: 7,
    is_deleted: false,
  } as Inventory);
  scoped.locations.push({
    id: "counter",
    code: "C1",
    name: "Quầy 1",
    type: LocationType.COUNTER,
  } as WarehouseLocation);
  scoped.itemReaders.transfers = async (id) => id === "intra-1"
    ? [{ ...transferItem, source_location_id: "aeon-shelf", destination_location_id: "counter", quantity: 7, received_quantity: 7 }]
    : [transferItem];

  const options = { dateMode: "month" as const, month: "2026-08" };
  const warehouse = await buildWarehouseMovementExportConfig(scoped, {
    ...options,
    dataKind: "movement",
  });
  const counter = await buildWarehouseMovementExportConfig(scoped, {
    ...options,
    dataKind: "counterDailySummary",
  });

  assert.equal(warehouse.data.reduce((sum, row) => sum + Number(row.import_quantity), 0), 25);
  assert.equal(counter.data[0].total_import_quantity, 7);
  assert.equal(counter.data[0].opening_quantity, 0);
  assert.equal(counter.data[0].total_ending_quantity, 7);
});
