const DEFAULT_CITYFUNS_API_BASE_URL = "https://cityfuns.joyworld.vn/api/v1";

export interface OnlineSalesSummary {
  orderCount: number;
  itemQuantity: number;
  passesIssued: number;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
  averageOrderValue: number;
}

export interface OnlineDailySale {
  date: string;
  orderCount: number;
  itemQuantity: number;
  grossRevenue: number;
  discountAmount: number;
  netRevenue: number;
}

export interface OnlineProductSale {
  productId: string;
  productName: string;
  productType: string;
  quantitySold: number;
  grossRevenue: number;
  netRevenue: number;
  orderCount: number;
}

export interface OnlinePaymentProvider {
  provider: string;
  orderCount: number;
  netRevenue: number;
}

export interface OnlineSalesReport {
  success: boolean;
  generatedAt: string;
  timeZone: string;
  range: {
    from: string;
    to: string;
  };
  summary: OnlineSalesSummary;
  dailySales: OnlineDailySale[];
  productSales: OnlineProductSale[];
  paymentProviders: OnlinePaymentProvider[];
}

export interface OnlineSalesReportParams {
  from: string;
  to: string;
}

export async function getOnlineSalesReport(
  params: OnlineSalesReportParams,
): Promise<OnlineSalesReport> {
  const apiKey = process.env.INTERNAL_API_KEY || process.env.CITYFUNS_INTERNAL_API_KEY;
  if (!apiKey) {
    throw new Error("[onlineSalesReportService] Missing INTERNAL_API_KEY.");
  }

  const baseUrl = (process.env.CITYFUNS_API_BASE_URL || DEFAULT_CITYFUNS_API_BASE_URL).replace(/\/$/, "");
  const qs = new URLSearchParams({
    from: params.from,
    to: params.to,
  });

  const response = await fetch(`${baseUrl}/reports/sales?${qs}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  const payload = (await response.json().catch(() => null)) as OnlineSalesReport | null;

  if (!response.ok || !payload?.success) {
    const message = payload && "message" in payload
      ? String((payload as { message?: unknown }).message ?? "")
      : "";
    throw new Error(
      `[onlineSalesReportService] getOnlineSalesReport failed: HTTP ${response.status}${message ? ` - ${message}` : ""}`,
    );
  }

  return normalizeOnlineSalesReport(payload);
}

function normalizeOnlineSalesReport(report: OnlineSalesReport): OnlineSalesReport {
  return {
    success: Boolean(report.success),
    generatedAt: String(report.generatedAt || new Date().toISOString()),
    timeZone: String(report.timeZone || "Asia/Ho_Chi_Minh"),
    range: {
      from: String(report.range?.from || ""),
      to: String(report.range?.to || ""),
    },
    summary: {
      orderCount: toNumber(report.summary?.orderCount),
      itemQuantity: toNumber(report.summary?.itemQuantity),
      passesIssued: toNumber(report.summary?.passesIssued),
      grossRevenue: toNumber(report.summary?.grossRevenue),
      discountAmount: toNumber(report.summary?.discountAmount),
      netRevenue: toNumber(report.summary?.netRevenue),
      averageOrderValue: toNumber(report.summary?.averageOrderValue),
    },
    dailySales: Array.isArray(report.dailySales)
      ? report.dailySales.map((row) => ({
        date: String(row.date || ""),
        orderCount: toNumber(row.orderCount),
        itemQuantity: toNumber(row.itemQuantity),
        grossRevenue: toNumber(row.grossRevenue),
        discountAmount: toNumber(row.discountAmount),
        netRevenue: toNumber(row.netRevenue),
      }))
      : [],
    productSales: Array.isArray(report.productSales)
      ? report.productSales.map((row) => ({
        productId: String(row.productId || ""),
        productName: String(row.productName || ""),
        productType: String(row.productType || ""),
        quantitySold: toNumber(row.quantitySold),
        grossRevenue: toNumber(row.grossRevenue),
        netRevenue: toNumber(row.netRevenue),
        orderCount: toNumber(row.orderCount),
      }))
      : [],
    paymentProviders: Array.isArray(report.paymentProviders)
      ? report.paymentProviders.map((row) => ({
        provider: String(row.provider || ""),
        orderCount: toNumber(row.orderCount),
        netRevenue: toNumber(row.netRevenue),
      }))
      : [],
  };
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
