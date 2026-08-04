const VIETNAM_TIME_ZONE = "Asia/Ho_Chi_Minh";

export const customerInvoiceRequestBusinessDate = (
  paymentTime: string,
): string => {
  const instant = new Date(paymentTime);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error("INVALID_INVOICE_REQUEST_PAYMENT_TIME");
  }
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: VIETNAM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
};

export const customerInvoiceRequestDeadline = (
  paymentTime: string,
): Date => {
  const businessDate = customerInvoiceRequestBusinessDate(paymentTime);
  return new Date(`${businessDate}T22:00:00+07:00`);
};

export const customerInvoiceRequestIsExpired = (
  paymentTime: string,
  now = new Date(),
): boolean => now.getTime() >= customerInvoiceRequestDeadline(paymentTime).getTime();
