type JsonRecord = Record<string, unknown>;

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const number = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const historicalPosOrderId = (sourceOrderId: string): string =>
  `JW-${sourceOrderId}`;

export const parseJoyworldLocalDateToIso = (value: unknown): string | null => {
  const source = text(value);
  if (!source) return null;
  const normalized = source.replace(" ", "T");
  const parsed = new Date(
    /(?:Z|[+-]\d{2}:?\d{2})$/u.test(normalized)
      ? normalized
      : `${normalized}+07:00`,
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

export const mapJoyworldPaymentMethod = (
  value: unknown,
): { id: "CASH" | "QR_CODE" | "OTHER"; name: string } => {
  const name = text(value) ?? "Khác";
  const normalized = name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase();
  if (/chuyen khoan|qr|bank/u.test(normalized)) {
    return { id: "QR_CODE", name: "Chuyển khoản" };
  }
  if (/tien mat|cash/u.test(normalized)) {
    return { id: "CASH", name: "Tiền mặt" };
  }
  return { id: "OTHER", name };
};

const buildHistoricalItem = (row: JsonRecord) => {
  const quantity = number(row.qty ?? row.quantity);
  const lineRealMoney = number(row.realMoney);
  const lineSystemMoney = number(row.sysMoney);
  const grossUnitPrice =
    quantity > 0
      ? (lineRealMoney || lineSystemMoney) / quantity
      : number(row.price);
  return {
    goodsId: text(row.goodsId) ?? text(row.id),
    goodsName: text(row.goodsName) ?? "Sản phẩm",
    price: grossUnitPrice,
    quantity,
    unitPriceBeforeTax: number(row.price),
    taxRate: number(row.taxRate),
    taxAmount: number(row.taxMoney),
    sourceLineId: text(row.id),
    categoryName: text(row.showCategoryName),
  };
};

export const buildHistoricalPosOrder = (input: {
  order: JsonRecord;
  goods: JsonRecord[];
  warehouseId: string;
  shopId: number;
  importedAt: string;
  rangeStart: string;
  rangeEnd: string;
}): { id: string; value: JsonRecord } | null => {
  const sourceOrderId = text(input.order.orderId ?? input.order.id);
  const paidAt = parseJoyworldLocalDateToIso(
    input.order.createTime ?? input.order.updateTime,
  );
  if (!sourceOrderId || !paidAt || number(input.order.status) !== 3) {
    return null;
  }

  const id = historicalPosOrderId(sourceOrderId);
  const payment = mapJoyworldPaymentMethod(input.order.payModeNames);
  return {
    id,
    value: {
      localOrderId: id,
      hkOrderNumber: text(input.order.orderNumber),
      warehouseId: input.warehouseId,
      shopId: input.shopId,
      status: "SYNC_SUCCESS",
      totalAmount: number(input.order.realMoney),
      voucherDiscount: number(input.order.discountMoney),
      items: input.goods.map(buildHistoricalItem),
      customerName: text(input.order.realName),
      customerPhone: text(input.order.phone),
      operatorId:
        text(input.order.employeeCode) ?? text(input.order.employeeId),
      operatorName: text(input.order.employeeName) ?? "JoyWorld",
      paymentMethod: payment.id,
      paymentMethodId: payment.id,
      paymentMethodName: payment.name,
      paidAt,
      createdAt: paidAt,
      updatedAt:
        parseJoyworldLocalDateToIso(input.order.updateTime) ?? paidAt,
      createdBy: "system:jpos-history-backfill",
      sync: {
        retryCount: 0,
        lastError: null,
        syncedAt: input.importedAt,
      },
      historicalImport: {
        sourceSystem: "JOYWORLD",
        sourceOrderId,
        importedAt: input.importedAt,
        rangeStart: input.rangeStart,
        rangeEnd: input.rangeEnd,
        version: 1,
      },
    },
  };
};
