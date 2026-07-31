type JsonRecord = Record<string, unknown>;

const asRecord = (value: unknown): JsonRecord =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};

const toNumberOrNull = (value: unknown): number | null => {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.replace(/,/g, ""))
        : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
};

const getSummaryData = (response: unknown): JsonRecord => {
  const root = asRecord(response);
  const data = root.data;
  if (Array.isArray(data)) return asRecord(data[0]);
  return asRecord(data);
};

/**
 * JoyWorld's shop summary exposes the net store revenue after refunds.
 * Prefer shopRealMoney and use totalMoney only for older response shapes.
 */
export const getNetShopRevenue = (response: unknown): number | null => {
  const data = getSummaryData(response);
  for (const key of ["shopRealMoney", "totalMoney"] as const) {
    if (!(key in data)) continue;
    const value = toNumberOrNull(data[key]);
    if (value !== null) return value;
  }
  return null;
};

export const getShopRefundMoney = (response: unknown): number =>
  toNumberOrNull(getSummaryData(response).refundMoney) ?? 0;
