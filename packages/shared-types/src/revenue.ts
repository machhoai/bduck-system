export const REVENUE_DATA_SOURCES = ["OPEN_API", "LOCAL_POS"] as const;
export type RevenueDataSource = (typeof REVENUE_DATA_SOURCES)[number];

export const REVENUE_EXPORT_REPORT_TYPES = [
  "DAILY_REVENUE",
  "SALES_COMPOSITION",
] as const;
export type RevenueExportReportType =
  (typeof REVENUE_EXPORT_REPORT_TYPES)[number];

export type RevenueDateMode = "today" | "date" | "month" | "year" | "custom";
export type RevenueChartGranularity = "day" | "month";
export type RevenuePaymentCategory = "cash" | "transfer" | "other";
export type RevenueTaxSource = "OPEN_API" | "LOCAL_POS" | "UNAVAILABLE";

export interface RevenueDashboardFilter {
  mode: RevenueDateMode;
  date: string;
  month: string;
  year: string;
  startDate: string;
  endDate: string;
}

export interface RevenueMetric {
  value: number;
  previousValue: number;
  changePercent: number;
}

export interface PaymentMethodMetric {
  method: string;
  category: RevenuePaymentCategory;
  amount: number;
  orderCount: number;
  percentage: number;
}

export interface RevenueChartPoint {
  key: string;
  label: string;
  revenue: number;
  orderCount: number;
  memberCardAmount: number;
  highlighted: boolean;
}

export interface RevenueDailyRow {
  date: string;
  totalRevenue: number;
  cashRevenue: number;
  transferRevenue: number;
  otherRevenue: number;
  totalTax: number;
  amountBeforeTax: number;
  orderCount: number;
}

export interface TopProductItem {
  name: string;
  quantity: number;
  revenue: number;
  taxAmount?: number;
}

export interface TopProductGroup {
  groupName: string;
  quantity: number;
  revenue: number;
  taxAmount?: number;
  items: TopProductItem[];
}

export interface DeviceConsumptionItem {
  date: string;
  electronicCoinConsum: number;
  physicalCoinConsum: number;
  totalConsum: number;
  coinGiveQuantity: number;
  coinConsumRate: string;
}

export interface RevenueOrderItem {
  orderId: string;
  orderNumber: string;
  status: number;
  statusLabel: string;
  createTime: string;
  employeeName: string;
  payMethod: string;
  terminalName: string;
  totalQty: number;
  itemCount: number;
  sysMoney: number;
  discountMoney: number;
  realMoney: number;
  cancelMoney: number;
  taxMoney?: number;
}

export interface SoldOrderGoodsItem {
  id: string;
  orderId: string;
  orderNumber: string;
  status: number;
  statusLabel: string;
  createTime: string;
  employeeName: string;
  payMethod: string;
  goodsName: string;
  goodsTypeName: string;
  categoryName: string;
  price: number;
  qty: number;
  sysMoney: number;
  discountMoney: number;
  realMoney: number;
  cancelQty: number;
  cancelMoney: number;
  taxMoney?: number;
}

export interface RevenueDashboardData {
  source: RevenueDataSource;
  taxSource: RevenueTaxSource;
  warehouseId: string;
  warehouseName: string;
  mode: RevenueDateMode;
  cacheKey: string;
  range: {
    startDate: string;
    endDate: string;
    label: string;
    highlightedDates: string[];
  };
  comparisonLabel: string;
  stats: {
    totalRevenue: RevenueMetric;
    cashRevenue: RevenueMetric;
    transferRevenue: RevenueMetric;
    otherRevenue: RevenueMetric;
    totalTax: RevenueMetric;
    amountBeforeTax: RevenueMetric;
    totalOrders: RevenueMetric;
    averageOrderValue: RevenueMetric;
    memberCardSales: RevenueMetric;
    deviceConsumption: RevenueMetric;
    memberCount: RevenueMetric;
    memberStoredBalance: RevenueMetric;
    memberGiftBalance: RevenueMetric;
    paymentMethods: PaymentMethodMetric[];
  };
  charts: {
    granularity: RevenueChartGranularity;
    points: RevenueChartPoint[];
    paymentMethods: PaymentMethodMetric[];
    memberCardSales: RevenueChartPoint[];
  };
  dailyRows: RevenueDailyRow[];
  topProductGroups: TopProductGroup[];
  deviceConsumptions: DeviceConsumptionItem[];
  orders: RevenueOrderItem[];
  soldItems: SoldOrderGoodsItem[];
  generatedAt: string;
}

export interface RevenueExportRequest extends RevenueDashboardFilter {
  source: RevenueDataSource;
  reportType: RevenueExportReportType;
  warehouseId: string;
  locale: "vi" | "zh";
  actionTime: string;
}
