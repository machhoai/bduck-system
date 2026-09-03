import type {
  MarketingVoucherCode,
  MarketingVoucherExportLocale,
} from "@bduck/shared-types";
import ExcelJS from "exceljs";
import QRCode from "qrcode";

const COPY = {
  vi: {
    sheet: "Voucher in ấn",
    headers: [
      "Mã Voucher",
      "Trạng thái",
      "Loại thưởng",
      "Giá trị",
      "Hết hạn",
      "SĐT nhận",
      "Ngày phát",
      "Ngày dùng",
      "QR Code",
    ],
    status: {
      AVAILABLE: "Sẵn sàng",
      DISTRIBUTED: "Đã phát",
      USED: "Đã dùng",
      REVOKED: "Vô hiệu",
    },
    reward: {
      DISCOUNT_PERCENT: "Giảm theo phần trăm",
      DISCOUNT_FIXED: "Giảm số tiền cố định",
      FREE_TICKET: "Vé miễn phí",
      FREE_ITEM: "Quà tặng miễn phí",
    },
  },
  zh: {
    sheet: "印刷优惠券",
    headers: [
      "优惠券码",
      "状态",
      "奖励类型",
      "奖励值",
      "到期日",
      "接收手机号",
      "发放日期",
      "使用日期",
      "二维码",
    ],
    status: {
      AVAILABLE: "可用",
      DISTRIBUTED: "已发放",
      USED: "已使用",
      REVOKED: "已撤销",
    },
    reward: {
      DISCOUNT_PERCENT: "百分比折扣",
      DISCOUNT_FIXED: "固定金额折扣",
      FREE_TICKET: "免费门票",
      FREE_ITEM: "免费赠品",
    },
  },
} as const;

const asDate = (value: Date | null) => value ?? "";

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const result = new Array<R>(values.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor++;
      result[index] = await mapper(values[index]);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), values.length) },
      worker,
    ),
  );
  return result;
}

export async function createMarketingVoucherWorkbook(input: {
  campaignName: string;
  codes: MarketingVoucherCode[];
  locale: MarketingVoucherExportLocale;
  qrConcurrency?: number;
}): Promise<Buffer> {
  const copy = COPY[input.locale];
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "JPULSE";
  workbook.created = new Date(0);
  workbook.modified = new Date(0);
  workbook.subject = input.campaignName;
  const worksheet = workbook.addWorksheet(copy.sheet, {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.columns = [25, 16, 24, 14, 16, 18, 20, 20, 18].map((width) => ({
    width,
  }));
  worksheet.autoFilter = { from: "A1", to: "I1" };
  const header = worksheet.addRow([...copy.headers]);
  header.height = 28;
  header.font = { bold: true, color: { argb: "FFFFFFFF" } };
  header.alignment = { vertical: "middle", horizontal: "center" };
  header.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E293B" },
    };
  });

  const qrBuffers = await mapConcurrent(
    input.codes,
    input.qrConcurrency ?? 8,
    (code) => QRCode.toBuffer(code.id, { type: "png", width: 112, margin: 1 }),
  );
  input.codes.forEach((code, index) => {
    const row = worksheet.addRow([
      code.id,
      copy.status[code.status],
      copy.reward[code.reward_type],
      code.reward_value,
      code.valid_to,
      code.distributed_to_phone ?? "",
      asDate(code.distributed_at),
      asDate(code.used_at),
      "",
    ]);
    row.height = 88;
    row.alignment = { vertical: "middle" };
    row.getCell(4).numFmt = "#,##0.##";
    [7, 8].forEach((cell) => {
      row.getCell(cell).numFmt = "yyyy-mm-dd hh:mm";
    });
    const imageId = workbook.addImage({
      base64: qrBuffers[index].toString("base64"),
      extension: "png",
    });
    worksheet.addImage(imageId, {
      tl: { col: 8.12, row: index + 1.08 },
      ext: { width: 104, height: 104 },
    });
  });
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } },
      };
    });
  });
  return Buffer.from(await workbook.xlsx.writeBuffer());
}
