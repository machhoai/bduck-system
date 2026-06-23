import type { PaymentMethodMetric, RevenueMetric } from "@/hooks/useRevenueDashboard";

export function formatCurrency(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

export function formatNumber(value: number): string {
  return Math.round(value).toLocaleString("vi-VN");
}

export function formatAxisValue(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)}tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

export function getMetricTone(metric: RevenueMetric): "up" | "down" | "flat" {
  if (metric.changePercent > 0) return "up";
  if (metric.changePercent < 0) return "down";
  return "flat";
}

export function getPaymentTotal(methods: PaymentMethodMetric[]): number {
  return methods.reduce((sum, item) => sum + item.amount, 0);
}

export const chartColors = {
  blue: "#0066cc",
  green: "#16a34a",
  red: "#dc2626",
  amber: "#f59e0b",
  slate: "#64748b",
  cyan: "#0891b2",
  violet: "#7c3aed",
};

export const donutColors = [
  "#0066cc",
  "#16a34a",
  "#f59e0b",
  "#dc2626",
  "#0891b2",
  "#7c3aed",
  "#e11d48",
  "#0d9488",
];
