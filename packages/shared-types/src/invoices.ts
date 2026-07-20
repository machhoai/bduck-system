export enum InvoiceDocumentStatus {
  SOURCE_SYNCED = "SOURCE_SYNCED",
  NEEDS_TAX_CONFIGURATION = "NEEDS_TAX_CONFIGURATION",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  NEEDS_SECOND_REVIEW = "NEEDS_SECOND_REVIEW",
  READY_TO_ISSUE = "READY_TO_ISSUE",
  QUEUED = "QUEUED",
  SUBMITTING = "SUBMITTING",
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
  ISSUED = "ISSUED",
  RETRYABLE_ERROR = "RETRYABLE_ERROR",
  MANUAL_RECONCILIATION = "MANUAL_RECONCILIATION",
  POST_ISSUE_REVIEW = "POST_ISSUE_REVIEW",
  REJECTED = "REJECTED",
  CANCELLED = "CANCELLED",
  CLOSED = "CLOSED",
}

export enum InvoiceIssueJobStatus {
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  PARTIAL = "PARTIAL",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum InvoiceIssueItemStatus {
  QUEUED = "QUEUED",
  SUBMITTING = "SUBMITTING",
  PENDING_CONFIRMATION = "PENDING_CONFIRMATION",
  ISSUED = "ISSUED",
  RETRYABLE_ERROR = "RETRYABLE_ERROR",
  MANUAL_RECONCILIATION = "MANUAL_RECONCILIATION",
  CANCELLED = "CANCELLED",
}

export interface InvoiceIssueJobCounts {
  total: number;
  queued: number;
  processing: number;
  pending_confirmation: number;
  issued: number;
  retryable_error: number;
  manual_reconciliation: number;
  cancelled: number;
}

export interface InvoiceIssueJob {
  id: string;
  warehouse_id: string;
  meinvoice_account_id: string;
  inv_series: string;
  status: InvoiceIssueJobStatus;
  idempotency_key: string;
  requested_by: string;
  counts: InvoiceIssueJobCounts;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export interface InvoiceIssueJobItem {
  id: string;
  job_id: string;
  warehouse_id: string;
  invoice_document_id: string;
  source_order_id: string;
  ref_id: string;
  prepared_payload_hash: string;
  status: InvoiceIssueItemStatus;
  attempt_count: number;
  next_attempt_at: Date | null;
  transaction_id: string | null;
  invoice_number: string | null;
  invoice_code: string | null;
  misa_error_code: string | null;
  last_error: string | null;
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
}

export enum InvoiceKind {
  ORIGINAL = "ORIGINAL",
  REPLACEMENT = "REPLACEMENT",
  ADJUSTMENT = "ADJUSTMENT",
}

export enum MeInvoiceEnvironment {
  SANDBOX = "SANDBOX",
  PRODUCTION = "PRODUCTION",
}

export enum MeInvoiceSignType {
  HSM = 2,
  HSM_ASYNC = 3,
  CALCULATING_MACHINE = 5,
  CALCULATING_MACHINE_ASYNC = 6,
}

export type InvoiceTaxRateSource =
  | "SOURCE"
  | "SKU"
  | "CATEGORY"
  | "MANUAL_REVIEW";

export enum InvoiceOrderSyncPurpose {
  ISSUE = "ISSUE",
  RECONCILIATION = "RECONCILIATION",
}

export enum InvoiceOrderSyncRunStatus {
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum InvoiceOrderMatchStatus {
  NOT_CHECKED = "NOT_CHECKED",
  MATCHED = "MATCHED",
  NOT_ISSUED = "NOT_ISSUED",
}

export enum InvoiceReconciliationCaseStatus {
  OPEN = "OPEN",
  RESOLVED = "RESOLVED",
}

export enum InvoiceReconciliationCaseType {
  SOURCE_NOT_IN_MISA = "SOURCE_NOT_IN_MISA",
  MISA_NOT_IN_SOURCE = "MISA_NOT_IN_SOURCE",
  LEDGER_MISMATCH = "LEDGER_MISMATCH",
  STATUS_MISMATCH = "STATUS_MISMATCH",
  MISA_INVOICE_DELETED = "MISA_INVOICE_DELETED",
  TAX_REJECTED = "TAX_REJECTED",
  MANUAL_REVIEW = "MANUAL_REVIEW",
}

export interface InvoiceDailyControlSummary {
  source_order_count: number;
  misa_invoice_count: number;
  matched_count: number;
  source_not_in_misa_count: number;
  misa_not_in_source_count: number;
  mismatch_count: number;
  unscoped_misa_count: number;
  source_total_amount: number;
  misa_total_amount: number;
}

export interface InvoiceLedgerEntry {
  id: string;
  warehouse_id: string;
  business_date: string;
  source_order_id: string;
  order_number: string | null;
  customer_name: string | null;
  invoice_document_status: InvoiceDocumentStatus | null;
  match_status: InvoiceOrderMatchStatus;
  ref_id: string | null;
  transaction_id: string | null;
  inv_series: string | null;
  invoice_number: string | null;
  invoice_code: string | null;
  invoice_date: string | null;
  publish_status: number | null;
  send_tax_status: number | null;
  total_amount: number | null;
  last_reconciled_at: Date | null;
  reconciliation_case_count: number;
}

export enum InvoicePreparationStatus {
  NEEDS_TAX_CONFIGURATION = "NEEDS_TAX_CONFIGURATION",
  NEEDS_REVIEW = "NEEDS_REVIEW",
  READY_FOR_REVIEW = "READY_FOR_REVIEW",
}

export type InvoiceVatRateName = "0%" | "5%" | "8%" | "10%" | "KCT" | "KKKNT";

export interface InvoiceSkuMapping {
  item_code?: string;
  item_name?: string;
  unit_name?: string;
  vat_rate_name?: InvoiceVatRateName;
}

export interface InvoiceSourceOrderLine {
  line_number: number;
  source_item_id: string | null;
  item_code: string | null;
  item_name: string | null;
  category_code: string | null;
  category_name: string | null;
  unit_name: string | null;
  quantity: number | null;
  unit_price: number | null;
  discount_rate: number | null;
  discount_amount: number | null;
  vat_rate_name: InvoiceVatRateName | null;
  vat_rate: number | null;
  source_amount_without_vat: number | null;
  source_vat_amount: number | null;
  source_total_amount: number | null;
}

export interface InvoiceCalculatedLine extends InvoiceSourceOrderLine {
  amount: number;
  calculated_discount_amount: number;
  amount_without_vat: number;
  vat_amount: number;
  total_amount: number;
}

export interface InvoiceTaxRateInfo {
  vat_rate_name: InvoiceVatRateName;
  amount_without_vat: number;
  vat_amount: number;
}

export interface InvoiceCalculationResult {
  version: string;
  lines: InvoiceCalculatedLine[];
  tax_rate_info: InvoiceTaxRateInfo[];
  total_amount_without_vat: number;
  total_vat_amount: number;
  total_amount: number;
  calculation_hash: string;
}

export type InvoicePreflightSeverity = "ERROR" | "WARNING";

export interface InvoicePreflightIssue {
  code: string;
  severity: InvoicePreflightSeverity;
  path: string;
  message: string;
}

export interface InvoicePreflightResult {
  status: InvoicePreparationStatus;
  issue_eligible: boolean;
  issues: InvoicePreflightIssue[];
}

export interface MeInvoiceAccount {
  id: string;
  legal_entity_id: string;
  display_name: string;
  tax_code: string;
  environment: MeInvoiceEnvironment;
  base_url: string;
  enabled: boolean;
  has_client_id: boolean;
  has_client_secret: boolean;
  has_username: boolean;
  has_password: boolean;
  last_tested_at: Date | null;
  last_test_succeeded: boolean | null;
  last_test_error_code: string | null;
  last_template_sync_at: Date | null;
  created_by: string;
  updated_by: string;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MeInvoiceOptionUserDefined {
  main_currency: string;
  amount_decimal_digits: number;
  amount_oc_decimal_digits: number;
  unit_price_oc_decimal_digits: number;
  unit_price_decimal_digits: number;
  quantity_decimal_digits: number;
  coefficient_decimal_digits: number;
  exchange_rate_decimal_digits: number;
}

export interface MeInvoiceStoreConfig {
  id: string;
  warehouse_id: string;
  meinvoice_account_id: string;
  inv_series: string;
  invoice_with_code: boolean;
  sign_type: MeInvoiceSignType;
  is_invoice_calculating_machine: boolean;
  seller_shop_code: string;
  seller_shop_name: string;
  price_includes_vat: boolean | null;
  tax_rate_source: InvoiceTaxRateSource;
  default_vat_rate_name: string | null;
  sku_mapping: Record<string, InvoiceSkuMapping>;
  category_vat_mapping: Record<string, InvoiceVatRateName>;
  payment_method_mapping: Record<string, string>;
  go_live_at: Date | null;
  invoice_date_source: "PAYMENT_TIME";
  issue_scope: "GO_LIVE_FORWARD";
  default_buyer_name: string;
  default_buyer_address: string;
  default_buyer_tax_code: null;
  option_user_defined: MeInvoiceOptionUserDefined;
  enabled: boolean;
  validated_at: Date | null;
  validation_error_code: string | null;
  created_by: string;
  updated_by: string;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceSourceOrder {
  id: string;
  warehouse_id: string;
  source_system: "JOYWORLD";
  source_order_id: string;
  source_payload_hash: string;
  business_date: string;
  source_create_time: string | null;
  payment_time: string | null;
  source_action_time: Date | null;
  source_sync_time: Date;
  source_status: number | null;
  order_number: string | null;
  customer_name: string | null;
  payment_method: string | null;
  mapped_payment_method: string | null;
  original_money: number | null;
  system_money: number | null;
  discount_money: number | null;
  real_money: number | null;
  cancel_money: number | null;
  tax_money: number | null;
  amount_before_tax: number | null;
  item_count: number;
  normalized_items: InvoiceSourceOrderLine[];
  calculation: InvoiceCalculationResult | null;
  preflight: InvoicePreflightResult;
  mapping_version: string;
  calculation_version: string;
  match_status: InvoiceOrderMatchStatus;
  invoice_document_id: string | null;
  invoice_document_status: InvoiceDocumentStatus | null;
  last_sync_run_id: string;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceDraftBuyer {
  full_name: string;
  legal_name: string;
  tax_code: string;
  address: string;
  phone_number: string;
  email: string;
}

export interface InvoiceDocumentRevisionSummary {
  revision: number;
  status: InvoiceDocumentStatus;
  financially_edited: boolean;
  edited_by: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  created_at: Date;
}

export interface InvoiceDocument {
  id: string;
  warehouse_id: string;
  legal_entity_id: string;
  meinvoice_account_id: string;
  source_order_document_id: string;
  source_system: "JOYWORLD";
  source_order_id: string;
  source_order_number: string | null;
  source_payload_hash: string;
  source_action_time: Date | null;
  payment_time: string;
  invoice_kind: InvoiceKind;
  status: InvoiceDocumentStatus;
  revision: number;
  buyer: InvoiceDraftBuyer;
  payment_method_name: string;
  items: InvoiceSourceOrderLine[];
  calculation: InvoiceCalculationResult | null;
  issue_eligible: boolean;
  validation_issues: InvoicePreflightIssue[];
  source_financial_fingerprint: string;
  financially_edited: boolean;
  mapping_version: string;
  calculation_version: string;
  ref_id: string | null;
  prepared_payload_hash: string | null;
  edited_by: string | null;
  edited_at: Date | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  review_note: string | null;
  rejected_by: string | null;
  rejected_at: Date | null;
  created_by: string;
  updated_by: string;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface InvoiceOrderSyncRun {
  id: string;
  warehouse_id: string;
  business_date: string;
  purpose: InvoiceOrderSyncPurpose;
  status: InvoiceOrderSyncRunStatus;
  order_count: number;
  inserted_count: number;
  updated_count: number;
  unchanged_count: number;
  error_code: string | null;
  requested_by: string;
  started_at: Date;
  completed_at: Date | null;
}

export interface MeInvoiceTemplate {
  ip_template_id: string;
  company_id: number | null;
  template_name: string;
  inv_template_no: string;
  inv_series: string;
  org_inv_series: string | null;
  inactive: boolean;
  is_send_summary: boolean;
  is_more_vat_rate: boolean;
}

const INVOICE_TRANSITIONS: Readonly<
  Record<InvoiceDocumentStatus, readonly InvoiceDocumentStatus[]>
> = {
  [InvoiceDocumentStatus.SOURCE_SYNCED]: [
    InvoiceDocumentStatus.NEEDS_TAX_CONFIGURATION,
    InvoiceDocumentStatus.NEEDS_REVIEW,
  ],
  [InvoiceDocumentStatus.NEEDS_TAX_CONFIGURATION]: [
    InvoiceDocumentStatus.NEEDS_REVIEW,
  ],
  [InvoiceDocumentStatus.NEEDS_REVIEW]: [
    InvoiceDocumentStatus.NEEDS_SECOND_REVIEW,
    InvoiceDocumentStatus.READY_TO_ISSUE,
    InvoiceDocumentStatus.REJECTED,
  ],
  [InvoiceDocumentStatus.NEEDS_SECOND_REVIEW]: [
    InvoiceDocumentStatus.READY_TO_ISSUE,
    InvoiceDocumentStatus.REJECTED,
  ],
  [InvoiceDocumentStatus.READY_TO_ISSUE]: [InvoiceDocumentStatus.QUEUED],
  [InvoiceDocumentStatus.QUEUED]: [
    InvoiceDocumentStatus.SUBMITTING,
    InvoiceDocumentStatus.CANCELLED,
  ],
  [InvoiceDocumentStatus.SUBMITTING]: [
    InvoiceDocumentStatus.PENDING_CONFIRMATION,
    InvoiceDocumentStatus.ISSUED,
    InvoiceDocumentStatus.RETRYABLE_ERROR,
    InvoiceDocumentStatus.MANUAL_RECONCILIATION,
  ],
  [InvoiceDocumentStatus.PENDING_CONFIRMATION]: [
    InvoiceDocumentStatus.ISSUED,
    InvoiceDocumentStatus.RETRYABLE_ERROR,
    InvoiceDocumentStatus.MANUAL_RECONCILIATION,
  ],
  [InvoiceDocumentStatus.ISSUED]: [InvoiceDocumentStatus.POST_ISSUE_REVIEW],
  [InvoiceDocumentStatus.RETRYABLE_ERROR]: [
    InvoiceDocumentStatus.QUEUED,
    InvoiceDocumentStatus.MANUAL_RECONCILIATION,
  ],
  [InvoiceDocumentStatus.MANUAL_RECONCILIATION]: [
    InvoiceDocumentStatus.ISSUED,
    InvoiceDocumentStatus.READY_TO_ISSUE,
    InvoiceDocumentStatus.CLOSED,
  ],
  [InvoiceDocumentStatus.POST_ISSUE_REVIEW]: [InvoiceDocumentStatus.CLOSED],
  [InvoiceDocumentStatus.REJECTED]: [InvoiceDocumentStatus.NEEDS_REVIEW],
  [InvoiceDocumentStatus.CANCELLED]: [InvoiceDocumentStatus.READY_TO_ISSUE],
  [InvoiceDocumentStatus.CLOSED]: [],
};

export const canTransitionInvoiceDocument = (
  from: InvoiceDocumentStatus,
  to: InvoiceDocumentStatus,
): boolean => INVOICE_TRANSITIONS[from].includes(to);
