import type { InvoiceBulkIssueInvoiceSummary } from "@bduck/shared-types";

type PaymentInvoice = Pick<
  InvoiceBulkIssueInvoiceSummary,
  "payment_method_name" | "total_amount"
>;

export interface BulkIssuePaymentSummary {
  paymentMethodName: string;
  invoiceCount: number;
  totalAmount: number;
}

export function summarizeBulkIssuePayments(
  invoices: readonly PaymentInvoice[],
  unspecifiedPaymentMethod: string,
): BulkIssuePaymentSummary[] {
  const summaries = new Map<string, BulkIssuePaymentSummary>();

  for (const invoice of invoices) {
    const paymentMethodName =
      invoice.payment_method_name.trim() || unspecifiedPaymentMethod;
    const current = summaries.get(paymentMethodName) ?? {
      paymentMethodName,
      invoiceCount: 0,
      totalAmount: 0,
    };

    current.invoiceCount += 1;
    current.totalAmount += invoice.total_amount;
    summaries.set(paymentMethodName, current);
  }

  return [...summaries.values()];
}
