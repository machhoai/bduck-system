import { createHash } from "node:crypto";
import type {
  InvoiceBulkIssueInvoiceSummary,
  InvoiceBulkIssueExcludedOrder,
  InvoiceBulkIssueProductSummary,
  InvoiceBulkIssueSummary,
  InvoiceCalculatedLine,
  MeInvoiceStoreConfig,
} from "@bduck/shared-types";
import {
  addDecimal,
  decimalToNumber,
  parseDecimal,
  zeroDecimal,
} from "./invoiceDecimal.js";
import { applyInvoiceDisplayMapping } from "./invoiceDisplayMapping.js";
import { invoiceLineShouldAppearInIssuedInvoice } from "./invoiceLineVisibilityPolicy.js";

export const bulkIssueRunId = (
  warehouseId: string,
  actorId: string,
  idempotencyKey: string,
) =>
  createHash("sha256")
    .update(`${warehouseId}:${actorId}:bulk:${idempotencyKey}`)
    .digest("hex");

export const bulkIssueSelectionFingerprint = (input: {
  warehouse_id: string;
  business_date: string;
  selection_mode: string;
  selected_ids: string[];
  config_fingerprint: string;
}) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        ...input,
        selected_ids: [...input.selected_ids].sort(),
      }),
    )
    .digest("hex");

export const bulkIssueConfigFingerprint = (
  config: Pick<
    MeInvoiceStoreConfig,
    | "item_name_mapping"
    | "item_unit_mapping"
    | "unit_name_mapping"
    | "default_unit_name"
  >,
) =>
  createHash("sha256")
    .update(
      JSON.stringify({
        item_name_mapping: Object.fromEntries(
          Object.entries(config.item_name_mapping).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ),
        item_unit_mapping: Object.fromEntries(
          Object.entries(config.item_unit_mapping ?? {}).sort(
            ([left], [right]) => left.localeCompare(right),
          ),
        ),
        unit_name_mapping: Object.fromEntries(
          Object.entries(config.unit_name_mapping).sort(([left], [right]) =>
            left.localeCompare(right),
          ),
        ),
        default_unit_name: config.default_unit_name,
      }),
    )
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
    beforeVat = addDecimal(
      beforeVat,
      parseDecimal(Number(calculation.total_amount_without_vat ?? 0)),
    );
    vat = addDecimal(
      vat,
      parseDecimal(Number(calculation.total_vat_amount ?? 0)),
    );
    total = addDecimal(
      total,
      parseDecimal(Number(calculation.total_amount ?? 0)),
    );
    const items = Array.isArray(document.items)
      ? (document.items as Record<string, unknown>[])
      : [];
    const invoiceItems = items.filter((item) =>
      invoiceLineShouldAppearInIssuedInvoice({
        unit_price:
          typeof item.unit_price === "number" ? item.unit_price : null,
      }),
    );
    productLineCount += invoiceItems.length;
    for (const item of invoiceItems) {
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

const summarizeProducts = (
  lines: InvoiceCalculatedLine[],
  config: Pick<
    MeInvoiceStoreConfig,
    | "item_name_mapping"
    | "item_unit_mapping"
    | "unit_name_mapping"
    | "default_unit_name"
  >,
): InvoiceBulkIssueProductSummary[] => {
  const products = new Map<string, InvoiceBulkIssueProductSummary>();

  for (const line of lines) {
    if (!invoiceLineShouldAppearInIssuedInvoice(line)) continue;
    const mapped = applyInvoiceDisplayMapping(line, config);
    const itemName = mapped.item_name ?? "—";
    const key = `${itemName}\u0000${mapped.unit_name ?? ""}`;
    const current = products.get(key) ?? {
      item_name: itemName,
      unit_name: mapped.unit_name,
      quantity: 0,
      invoice_count: 1,
    };
    current.quantity = decimalToNumber(
      addDecimal(
        parseDecimal(current.quantity),
        parseDecimal(Number(mapped.quantity ?? 0)),
      ),
    );
    products.set(key, current);
  }

  return [...products.values()].sort((left, right) =>
    left.item_name.localeCompare(right.item_name, "vi"),
  );
};

export const buildBulkIssueInvoiceSummaries = (
  eligibleDocuments: Record<string, unknown>[],
  config: MeInvoiceStoreConfig,
): {
  invoices: InvoiceBulkIssueInvoiceSummary[];
  product_summary: InvoiceBulkIssueProductSummary[];
} => {
  const overall = new Map<
    string,
    InvoiceBulkIssueProductSummary & { invoice_ids: Set<string> }
  >();

  const invoices = eligibleDocuments.map((document) => {
    const calculation = document.calculation as Record<string, unknown>;
    const lines = Array.isArray(calculation.lines)
      ? (calculation.lines as InvoiceCalculatedLine[])
      : [];
    const products = summarizeProducts(lines, config);
    const documentId = String(document.id);

    for (const product of products) {
      const key = `${product.item_name}\u0000${product.unit_name ?? ""}`;
      const current = overall.get(key) ?? {
        ...product,
        quantity: 0,
        invoice_count: 0,
        invoice_ids: new Set<string>(),
      };
      current.quantity = decimalToNumber(
        addDecimal(
          parseDecimal(current.quantity),
          parseDecimal(product.quantity),
        ),
      );
      current.invoice_ids.add(documentId);
      current.invoice_count = current.invoice_ids.size;
      overall.set(key, current);
    }

    return {
      source_order_document_id: documentId,
      source_order_id: String(document.source_order_id),
      order_number:
        typeof document.source_order_number === "string"
          ? document.source_order_number
          : null,
      payment_time: String(document.payment_time),
      total_amount_without_vat: Number(
        calculation.total_amount_without_vat ?? 0,
      ),
      total_vat_amount: Number(calculation.total_vat_amount ?? 0),
      total_amount: Number(calculation.total_amount ?? 0),
      products,
    };
  });

  return {
    invoices,
    product_summary: [...overall.values()]
      .map(({ invoice_ids: _invoiceIds, ...product }) => product)
      .sort((left, right) =>
        left.item_name.localeCompare(right.item_name, "vi"),
      ),
  };
};
