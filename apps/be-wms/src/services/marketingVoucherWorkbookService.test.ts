import assert from "node:assert/strict";
import test from "node:test";

import type { MarketingVoucherCode } from "@bduck/shared-types";
import ExcelJS from "exceljs";
import * as jsQRModule from "jsqr";
import { PNG } from "pngjs";

import { createMarketingVoucherWorkbook } from "./marketingVoucherWorkbookService.js";

const decodeQr = jsQRModule.default as unknown as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
) => { data: string } | null;

const code = (id: string, status: MarketingVoucherCode["status"]) =>
  ({
    id,
    status,
    reward_type: "DISCOUNT_PERCENT",
    reward_value: 20,
    valid_to: "2026-12-31",
    distributed_to_phone: null,
    distributed_at: new Date("2026-09-01T01:00:00.000Z"),
    used_at: null,
  }) as MarketingVoucherCode;

test("voucher workbook contains exact rows and scannable QR codes", async () => {
  const voucherCodes = [
    code("JPULSE-PRINT-0001", "DISTRIBUTED"),
    code("JPULSE-PRINT-0002", "USED"),
  ];
  const buffer = await createMarketingVoucherWorkbook({
    campaignName: "September print",
    codes: voucherCodes,
    locale: "vi",
    qrConcurrency: 2,
  });
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as never);
  const worksheet = workbook.worksheets[0]!;
  assert.equal(worksheet.rowCount, 3);
  assert.equal(worksheet.getCell("A1").value, "Mã Voucher");
  assert.equal(worksheet.getCell("A2").value, voucherCodes[0]!.id);
  assert.equal(worksheet.getCell("B2").value, "Đã phát");
  assert.equal(worksheet.getImages().length, voucherCodes.length);

  worksheet.getImages().forEach((image, index) => {
    const model = workbook.getImage(Number(image.imageId));
    const imageBuffer = model.buffer
      ? Buffer.from(model.buffer)
      : Buffer.from(model.base64 ?? "", "base64");
    const png = PNG.sync.read(imageBuffer);
    const decoded = decodeQr(
      new Uint8ClampedArray(png.data),
      png.width,
      png.height,
    );
    assert.equal(decoded?.data, voucherCodes[index]!.id);
  });
});
