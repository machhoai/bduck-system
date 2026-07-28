import type { InvoiceSourceOrderLine } from "@bduck/shared-types";

export const invoiceLineShouldAppearInIssuedInvoice = (
  line: Pick<InvoiceSourceOrderLine, "unit_price">,
): boolean => line.unit_price !== 0;
