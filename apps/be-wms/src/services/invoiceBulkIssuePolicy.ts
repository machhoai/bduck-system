import { createHash } from "node:crypto";
import type {
  InvoiceBulkIssueExcludedOrder,
  InvoiceBulkIssueSummary,
} from "@bduck/shared-types";
import {
  addDecimal,
  decimalToNumber,
  parseDecimal,
  zeroDecimal,
} from "./invoiceDecimal.js";

export const bulkIssueRunId = (
  warehouseId: string,
  actorId: string,
  idempotencyKey: string,
) => createHash("sha256")
  .update(`${warehouseId}:${actorId}:bulk:${idempotencyKey}`)
  .digest("hex");

export const bulkIssueSelectionFingerprint = (input: {
  warehouse_id: string;
  business_date: string;
  selection_mode: string;
  selected_ids: string[];
}) => createHash("sha256")
  .update(JSON.stringify({ ...input, selected_ids: [...input.selected_ids].sort() }))
  .digest("hex");

export const chunkInvoiceIds = (ids: string[], size = 30) => {
  const chunks: string[][] = [];
  for (let cursor = 0; cursor < ids.length; cursor += size) {
    chunks.push(ids.slice(cursor, cursor + size));
  }
  return chunks;
};

export const summarizeBulkIssue = (
  selectedCount: number,
  eligibleDocuments: Record<string, unknown>[],
  excluded: InvoiceBulkIssueExcludedOrder[],
): InvoiceBulkIssueSummary => {
  let beforeVat = zeroDecimal();
  let vat = zeroDecimal();
  let total = zeroDecimal();
  let quantity = zeroDecimal();
  let productLineCount = 0;

  for (const document of eligibleDocuments) {
    const calculation = document.calculation as Record<string, unknown>;
    beforeVat = addDecimal(beforeVat, parseDecimal(Number(calculation.total_amount_without_vat ?? 0)));
    vat = addDecimal(vat, parseDecimal(Number(calculation.total_vat_amount ?? 0)));
    total = addDecimal(total, parseDecimal(Number(calculation.total_amount ?? 0)));
    const items = Array.isArray(document.items) ? document.items as Record<string, unknown>[] : [];
    productLineCount += items.length;
    for (const item of items) {
      quantity = addDecimal(quantity, parseDecimal(Number(item.quantity ?? 0)));
    }
  }

  return {
    invoice_count: selectedCount,
    eligible_count: eligibleDocuments.length,
    excluded_count: excluded.length,
    total_amount_without_vat: decimalToNumber(beforeVat),
    total_vat_amount: decimalToNumber(vat),
    total_amount: decimalToNumber(total),
    product_line_count: productLineCount,
    product_quantity: decimalToNumber(quantity),
  };
};

