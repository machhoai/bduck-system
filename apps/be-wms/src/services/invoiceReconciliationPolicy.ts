import {
  InvoiceOrderMatchStatus,
  InvoiceReconciliationCaseType,
  type InvoiceDailyControlSummary,
} from "@bduck/shared-types";

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const field = (record: Record<string, unknown>, ...names: string[]) => {
  for (const name of names) if (name in record) return record[name];
  return undefined;
};

const text = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value.trim() : null;

const identifier = (value: unknown): string | null =>
  text(value) ?? (typeof value === "number" && Number.isFinite(value) ? String(value) : null);

const number = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const customData = (value: unknown) => {
  if (typeof value !== "string") return asRecord(value);
  try {
    return asRecord(JSON.parse(value));
  } catch {
    return {};
  }
};

export interface NormalizedMisaInvoice {
  ref_id: string | null;
  transaction_id: string | null;
  inv_series: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  invoice_code: string | null;
  buyer_order_code: string | null;
  seller_shop_code: string | null;
  total_amount: number | null;
  publish_status: number | null;
  send_tax_status: number | null;
  is_deleted: boolean;
}

export const normalizeMisaInvoice = (value: unknown): NormalizedMisaInvoice => {
  const record = asRecord(value);
  const custom = customData(field(record, "CustomData", "customData"));
  return {
    ref_id: text(field(record, "RefID", "RefId", "refID", "refId")),
    transaction_id: text(field(record, "TransactionID", "transactionID", "transactionId")),
    inv_series: text(field(record, "InvSeries", "invSeries")),
    invoice_number: identifier(field(record, "InvNo", "InvoiceNumber", "invNo", "invoiceNumber")),
    invoice_date: identifier(field(record, "InvDate", "InvoiceDate", "invDate", "invoiceDate")),
    invoice_code: text(field(record, "InvoiceCode", "InvCode", "invoiceCode", "invCode")),
    buyer_order_code:
      text(field(record, "BuyerOrderCode", "OrderCode", "buyerOrderCode", "orderCode")) ??
      text(field(custom, "BuyerOrderCode", "OrderCode", "buyerOrderCode", "orderCode")),
    seller_shop_code:
      text(field(record, "SellerShopCode", "sellerShopCode")) ??
      text(field(custom, "SellerShopCode", "sellerShopCode")),
    total_amount: number(field(record, "TotalAmount", "TotalAmountOC", "totalAmount", "totalAmountOC")),
    publish_status: number(field(record, "PublishStatus", "publishStatus")),
    send_tax_status: number(field(record, "SendTaxStatus", "sendTaxStatus")),
    is_deleted: field(record, "IsDelete", "isDelete") === true,
  };
};

export interface ReconciliationInputSource {
  id: string;
  source_order_id: string;
  order_number: string | null;
  real_money: number | null;
  invoice_document_id: string | null;
}

export interface ReconciliationInputDocument {
  id: string;
  ref_id: string | null;
  transaction_id: string | null;
}

export interface DailyReconciliationMatch {
  source: ReconciliationInputSource;
  document: ReconciliationInputDocument | null;
  misa: NormalizedMisaInvoice | null;
  match_status: InvoiceOrderMatchStatus;
  mismatch_fields: string[];
}

export interface DailyReconciliationCaseCandidate {
  type: InvoiceReconciliationCaseType;
  source_order_document_id: string | null;
  invoice_document_id: string | null;
  misa_ref_id: string | null;
  misa_transaction_id: string | null;
  details: Record<string, unknown>;
}

const invoiceIdentity = (invoice: NormalizedMisaInvoice) =>
  invoice.transaction_id ?? invoice.ref_id ?? null;

export const reconcileDailyInvoices = (input: {
  sources: ReconciliationInputSource[];
  documents: ReconciliationInputDocument[];
  misaInvoices: NormalizedMisaInvoice[];
  sellerShopCode: string;
  invSeries: string;
  invoiceWithCode: boolean;
}): {
  matches: DailyReconciliationMatch[];
  cases: DailyReconciliationCaseCandidate[];
  summary: InvoiceDailyControlSummary;
} => {
  const documents = new Map(input.documents.map((item) => [item.id, item]));
  const matchedMisa = new Set<string>();
  const cases: DailyReconciliationCaseCandidate[] = [];
  const matches = input.sources.map((source): DailyReconciliationMatch => {
    const document = source.invoice_document_id
      ? documents.get(source.invoice_document_id) ?? null
      : null;
    const candidates = input.misaInvoices.filter((invoice) =>
      Boolean(
        (document?.transaction_id && invoice.transaction_id === document.transaction_id) ||
        (document?.ref_id && invoice.ref_id === document.ref_id) ||
        (invoice.buyer_order_code &&
          [source.source_order_id, source.order_number].filter(Boolean).includes(invoice.buyer_order_code)),
      ),
    );
    if (candidates.length !== 1) {
      cases.push({
        type: candidates.length === 0
          ? InvoiceReconciliationCaseType.SOURCE_NOT_IN_MISA
          : InvoiceReconciliationCaseType.LEDGER_MISMATCH,
        source_order_document_id: source.id,
        invoice_document_id: document?.id ?? null,
        misa_ref_id: null,
        misa_transaction_id: null,
        details: { candidate_count: candidates.length },
      });
      return {
        source,
        document,
        misa: null,
        match_status: InvoiceOrderMatchStatus.NOT_ISSUED,
        mismatch_fields: candidates.length > 1 ? ["duplicate_match"] : [],
      };
    }

    const misa = candidates[0]!;
    const identity = invoiceIdentity(misa);
    if (identity) matchedMisa.add(identity);
    const mismatchFields: string[] = [];
    if (misa.inv_series && misa.inv_series !== input.invSeries) mismatchFields.push("inv_series");
    if (
      source.real_money !== null &&
      misa.total_amount !== null &&
      Math.abs(source.real_money - misa.total_amount) >= 1
    ) mismatchFields.push("total_amount");
    if (misa.is_deleted) mismatchFields.push("is_deleted");
    if (mismatchFields.length) {
      cases.push({
        type: misa.is_deleted
          ? InvoiceReconciliationCaseType.MISA_INVOICE_DELETED
          : InvoiceReconciliationCaseType.LEDGER_MISMATCH,
        source_order_document_id: source.id,
        invoice_document_id: document?.id ?? null,
        misa_ref_id: misa.ref_id,
        misa_transaction_id: misa.transaction_id,
        details: { mismatch_fields: mismatchFields },
      });
    }
    if (misa.send_tax_status !== null && taxStatusIsRejected(misa.send_tax_status, input.invoiceWithCode)) {
      cases.push({
        type: InvoiceReconciliationCaseType.TAX_REJECTED,
        source_order_document_id: source.id,
        invoice_document_id: document?.id ?? null,
        misa_ref_id: misa.ref_id,
        misa_transaction_id: misa.transaction_id,
        details: { send_tax_status: misa.send_tax_status },
      });
    }
    if (misa.publish_status !== null && misa.publish_status !== 1) {
      cases.push({
        type: InvoiceReconciliationCaseType.STATUS_MISMATCH,
        source_order_document_id: source.id,
        invoice_document_id: document?.id ?? null,
        misa_ref_id: misa.ref_id,
        misa_transaction_id: misa.transaction_id,
        details: { publish_status: misa.publish_status },
      });
    }
    return {
      source,
      document,
      misa,
      match_status: InvoiceOrderMatchStatus.MATCHED,
      mismatch_fields: mismatchFields,
    };
  });

  let unscopedMisaCount = 0;
  for (const misa of input.misaInvoices) {
    const identity = invoiceIdentity(misa);
    if (identity && matchedMisa.has(identity)) continue;
    if (!misa.seller_shop_code) {
      unscopedMisaCount += 1;
      continue;
    }
    if (misa.seller_shop_code !== input.sellerShopCode) continue;
    cases.push({
      type: InvoiceReconciliationCaseType.MISA_NOT_IN_SOURCE,
      source_order_document_id: null,
      invoice_document_id: null,
      misa_ref_id: misa.ref_id,
      misa_transaction_id: misa.transaction_id,
      details: { invoice_number: misa.invoice_number },
    });
  }

  const matched = matches.filter((item) => item.match_status === InvoiceOrderMatchStatus.MATCHED);
  const summary: InvoiceDailyControlSummary = {
    source_order_count: input.sources.length,
    misa_invoice_count: input.misaInvoices.length,
    matched_count: matched.length,
    source_not_in_misa_count: cases.filter((item) => item.type === InvoiceReconciliationCaseType.SOURCE_NOT_IN_MISA).length,
    misa_not_in_source_count: cases.filter((item) => item.type === InvoiceReconciliationCaseType.MISA_NOT_IN_SOURCE).length,
    mismatch_count: cases.filter((item) => [
      InvoiceReconciliationCaseType.LEDGER_MISMATCH,
      InvoiceReconciliationCaseType.MISA_INVOICE_DELETED,
      InvoiceReconciliationCaseType.STATUS_MISMATCH,
      InvoiceReconciliationCaseType.TAX_REJECTED,
    ].includes(item.type)).length,
    unscoped_misa_count: unscopedMisaCount,
    source_total_amount: input.sources.reduce((sum, item) => sum + (item.real_money ?? 0), 0),
    misa_total_amount: matched.reduce((sum, item) => sum + (item.misa?.total_amount ?? 0), 0),
  };
  return { matches, cases, summary };
};

export const taxStatusIsRejected = (
  sendTaxStatus: number | null,
  invoiceWithCode: boolean,
) => invoiceWithCode ? sendTaxStatus === 3 : sendTaxStatus === 3 || sendTaxStatus === 4;
