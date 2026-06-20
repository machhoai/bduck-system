import { format } from "date-fns";
import { vi } from "date-fns/locale";
import type { UnifiedVoucher } from "@/types/unified-voucher";

function parseVoucherDate(value: unknown): Date | null {
  if (!value) return null;
  let date: Date;
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    date = (value as { toDate: () => Date }).toDate();
  } else if ((value as { _seconds?: number })._seconds !== undefined) {
    date = new Date((value as { _seconds: number })._seconds * 1000);
  } else if ((value as { seconds?: number }).seconds !== undefined) {
    date = new Date((value as { seconds: number }).seconds * 1000);
  } else {
    date = new Date(value as string);
  }
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatVoucherDateTime(value: unknown): string {
  const date = parseVoucherDate(value);
  if (!date) return "";
  return format(date, "dd/MM/yyyy HH:mm", { locale: vi });
}

export function isSessionVoucher(voucher: UnifiedVoucher) {
  if (voucher.type === "IMPORT") {
    return ["APPROVED", "RECEIVING"].includes(voucher.status);
  }
  if (voucher.type === "EXPORT") {
    return ["APPROVED", "PICKING"].includes(voucher.status);
  }
  return voucher.type === "TRANSFER" && ["PENDING_RECEIVE", "RECEIVING"].includes(voucher.status);
}

export function isCompletionVoucher(voucher: UnifiedVoucher) {
  return voucher.type === "EXPORT" && voucher.status === "SHIPPED";
}

export function countSessionVouchers(vouchers: UnifiedVoucher[]) {
  return vouchers.filter(isSessionVoucher).length;
}

export function countCompletionVouchers(vouchers: UnifiedVoucher[]) {
  return vouchers.filter(isCompletionVoucher).length;
}
