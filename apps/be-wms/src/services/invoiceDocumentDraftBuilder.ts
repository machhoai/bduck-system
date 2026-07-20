import {
  InvoiceDocumentStatus,
  InvoiceKind,
  InvoicePreparationStatus,
  type InvoicePreflightIssue,
  type InvoiceSourceOrderLine,
  type MeInvoiceStoreConfig,
} from "@bduck/shared-types";
import type { StoredMeInvoiceAccount } from "../repositories/meInvoiceConfigRepository.js";
import { invoiceFinancialFingerprint } from "./invoiceDocumentPolicy.js";
import { parseJoyworldDate } from "./invoiceOrderSyncUtils.js";

type JsonRecord = Record<string, unknown>;

const asItems = (value: unknown): InvoiceSourceOrderLine[] =>
  Array.isArray(value) ? (value as InvoiceSourceOrderLine[]) : [];

const asPreflight = (value: unknown) =>
  value && typeof value === "object"
    ? (value as {
        status?: InvoicePreparationStatus;
        issue_eligible?: boolean;
        issues?: InvoicePreflightIssue[];
      })
    : {};

const asDate = (value: unknown): Date | null => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value && typeof value === "object" && "toDate" in value) {
    const candidate = (value as { toDate?: unknown }).toDate;
    if (typeof candidate === "function") {
      const date = candidate.call(value);
      if (date instanceof Date && !Number.isNaN(date.getTime())) return date;
    }
  }
  return null;
};

const documentStatusFromPreparation = (
  status: InvoicePreparationStatus | undefined,
): InvoiceDocumentStatus =>
  status === InvoicePreparationStatus.NEEDS_TAX_CONFIGURATION
    ? InvoiceDocumentStatus.NEEDS_TAX_CONFIGURATION
    : InvoiceDocumentStatus.NEEDS_REVIEW;

export const buildInitialInvoiceDocument = (
  sourceOrder: JsonRecord,
  storeConfig: MeInvoiceStoreConfig,
  account: StoredMeInvoiceAccount,
  actorId: string,
  now = new Date(),
): JsonRecord | null => {
  const sourceOrderDocumentId = String(sourceOrder.id ?? "");
  const sourceOrderId = String(sourceOrder.source_order_id ?? "");
  const sourcePayloadHash = String(sourceOrder.source_payload_hash ?? "");
  const paymentTime =
    typeof sourceOrder.payment_time === "string"
      ? sourceOrder.payment_time
      : "";
  if (
    !sourceOrderDocumentId ||
    !sourceOrderId ||
    !sourcePayloadHash ||
    !paymentTime
  ) {
    return null;
  }
  const items = asItems(sourceOrder.normalized_items);
  const preflight = asPreflight(sourceOrder.preflight);
  return {
    id: sourceOrderDocumentId,
    warehouse_id: sourceOrder.warehouse_id,
    legal_entity_id: account.legal_entity_id,
    meinvoice_account_id: account.id,
    source_order_document_id: sourceOrderDocumentId,
    source_system: "JOYWORLD",
    source_order_id: sourceOrderId,
    source_order_number: sourceOrder.order_number ?? null,
    source_payload_hash: sourcePayloadHash,
    source_action_time:
      asDate(sourceOrder.source_action_time) ?? parseJoyworldDate(paymentTime),
    payment_time: paymentTime,
    invoice_kind: InvoiceKind.ORIGINAL,
    status: documentStatusFromPreparation(preflight.status),
    revision: 1,
    buyer: {
      full_name: storeConfig.default_buyer_name,
      legal_name: "",
      tax_code: "",
      address: storeConfig.default_buyer_address,
      phone_number: "",
      email: "",
    },
    payment_method_name: sourceOrder.mapped_payment_method ?? "",
    items,
    calculation: sourceOrder.calculation ?? null,
    issue_eligible: preflight.issue_eligible === true,
    validation_issues: preflight.issues ?? [],
    source_financial_fingerprint: invoiceFinancialFingerprint(items),
    financially_edited: false,
    mapping_version: sourceOrder.mapping_version,
    calculation_version: sourceOrder.calculation_version,
    ref_id: null,
    prepared_payload_hash: null,
    edited_by: null,
    edited_at: null,
    reviewed_by: null,
    reviewed_at: null,
    review_note: null,
    rejected_by: null,
    rejected_at: null,
    created_by: actorId,
    updated_by: actorId,
    is_deleted: false,
    created_at: now,
    updated_at: now,
  };
};
