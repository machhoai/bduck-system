import type {
  ISOTimestamped,
  LocalDate,
  LocalizedText,
  SoftDeletable,
} from "./utility.js";

export const EMPLOYEE_CONTRACT_IMPORT_TEMPLATE_VERSION = "1.0" as const;
export const EMPLOYEE_CONTRACT_IMPORT_MAX_ROWS = 100 as const;
export const EMPLOYEE_CONTRACT_IMPORT_EXCEL_MAX_BYTES = 5 * 1024 * 1024;
export const EMPLOYEE_CONTRACT_PDF_MAX_BYTES = 10 * 1024 * 1024;
export const EMPLOYEE_CONTRACT_EXPIRY_WARNING_DAYS = 30 as const;

export const resolveEmployeeContractsFeatureEnabled = (
  value: string | undefined,
  nodeEnvironment: string | undefined,
): boolean => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return nodeEnvironment !== "production";
  if (["1", "true", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "off", "disabled"].includes(normalized)) return false;
  throw new Error("EMPLOYEE_CONTRACTS_FEATURE_ENABLED_INVALID");
};

export enum EmployeeContractType {
  PROBATION = "PROBATION",
  FIXED_TERM = "FIXED_TERM",
  INDEFINITE = "INDEFINITE",
  SEASONAL = "SEASONAL",
}

export enum EmployeeContractStatus {
  UPCOMING = "UPCOMING",
  ACTIVE = "ACTIVE",
  EXPIRED = "EXPIRED",
  TERMINATED = "TERMINATED",
  CANCELLED = "CANCELLED",
}

export enum EmployeeContractImportLifecycleState {
  TERMINATED = "TERMINATED",
  CANCELLED = "CANCELLED",
}

export enum EmployeeContractImportBatchStatus {
  PREVIEWED = "PREVIEWED",
  COMMITTING = "COMMITTING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
}

export enum EmployeeContractImportRowStatus {
  VALID = "VALID",
  INVALID = "INVALID",
  COMMITTED = "COMMITTED",
  FAILED = "FAILED",
}

export enum EmployeeContractDocumentUploadIntentStatus {
  PENDING = "PENDING",
  FINALIZED = "FINALIZED",
  EXPIRED = "EXPIRED",
  REJECTED = "REJECTED",
}

export enum EmployeeContractAutomationRunStatus {
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export type EmployeeContractAutomationJobType =
  | "DAILY_MAINTENANCE"
  | "STATUS_SYNC"
  | "EXPIRY_WARNING";

export interface EmployeeContract extends SoftDeletable, ISOTimestamped {
  id: string;
  employee_profile_id: string;
  employee_user_id: string | null;
  workplace_warehouse_id: string;
  contract_number: string;
  contract_number_normalized: string;
  contract_type: EmployeeContractType;
  start_date: LocalDate;
  end_date: LocalDate | null;
  status: EmployeeContractStatus;
  renewed_from_contract_id: string | null;
  root_contract_id: string;
  renewal_sequence: number;
  termination_date: LocalDate | null;
  termination_reason: string | null;
  terminated_by: string | null;
  terminated_at: Date | null;
  cancellation_reason: string | null;
  cancelled_by: string | null;
  cancelled_at: Date | null;
  notes: string | null;
  revision: number;
  created_by: string;
  updated_by: string;
}

export interface EmployeeContractExpiryView extends EmployeeContract {
  employee_code: string;
  employee_name: string;
  days_until_expiry: number;
}

export interface EmployeeContractAutomationRun
  extends SoftDeletable,
    ISOTimestamped {
  id: string;
  job_type: EmployeeContractAutomationJobType;
  as_of_date: LocalDate;
  status: EmployeeContractAutomationRunStatus;
  attempt: number;
  lease_expires_at: Date;
  completed_at: Date | null;
  failed_at: Date | null;
  error_message: string | null;
  result: EmployeeContractAutomationResult | null;
}

export interface EmployeeContractAutomationResult {
  as_of_date: LocalDate;
  status_checked: number;
  status_updated: number;
  status_skipped: number;
  warning_candidates: number;
  warnings_created: number;
  warning_recipients: number;
  warning_skipped: number;
  replayed: boolean;
  in_progress: boolean;
}

export interface EmployeeContractDocument
  extends SoftDeletable, ISOTimestamped {
  id: string;
  contract_id: string;
  employee_profile_id: string;
  employee_user_id: string | null;
  workplace_warehouse_id: string;
  storage_path: string;
  storage_generation: string;
  upload_intent_id: string;
  original_file_name: string;
  mime_type: "application/pdf";
  file_size: number;
  sha256: string;
  version: number;
  is_current: boolean;
  uploaded_by: string;
  updated_by: string;
}

export interface EmployeeContractDocumentUploadIntent
  extends SoftDeletable, ISOTimestamped {
  id: string;
  contract_id: string;
  employee_profile_id: string;
  employee_user_id: string | null;
  workplace_warehouse_id: string;
  original_file_name: string;
  upload_storage_path: string;
  expected_mime_type: "application/pdf";
  max_file_size: number;
  status: EmployeeContractDocumentUploadIntentStatus;
  request_hash: string;
  expires_at: Date;
  finalized_document_id: string | null;
  finalized_at: Date | null;
  failure_code: string | null;
  created_by: string;
  updated_by: string;
}

export interface CreateEmployeeContractDocumentUploadIntentInput {
  original_file_name: string;
  idempotency_key: string;
  action_time: Date;
}

export interface FinalizeEmployeeContractDocumentUploadInput {
  idempotency_key: string;
  action_time: Date;
}

export interface EmployeeContractSignedUploadIntent {
  intent: EmployeeContractDocumentUploadIntent;
  method: "POST";
  upload_url: string;
  fields: Record<string, string>;
  expires_at: Date;
  max_file_size: number;
}

export interface EmployeeContractSignedDownload {
  document_id: string;
  url: string;
  expires_at: Date;
}

export interface EmployeeContractDocumentMutationResult {
  document: EmployeeContractDocument;
  replayed: boolean;
}

export interface CreateEmployeeContractInput {
  contract_number: string;
  contract_type: EmployeeContractType;
  start_date: LocalDate;
  end_date: LocalDate | null;
  notes?: string | null;
  idempotency_key: string;
  action_time: Date;
}

export interface UpdateEmployeeContractInput {
  contract_number?: string;
  contract_type?: EmployeeContractType;
  start_date?: LocalDate;
  end_date?: LocalDate | null;
  notes?: string | null;
  expected_revision: number;
  idempotency_key: string;
  action_time: Date;
}

export interface RenewEmployeeContractInput extends CreateEmployeeContractInput {
  expected_revision: number;
}

export interface CancelEmployeeContractInput {
  reason: string;
  expected_revision: number;
  idempotency_key: string;
  action_time: Date;
}

export interface TerminateEmployeeContractInput extends CancelEmployeeContractInput {
  termination_date: LocalDate;
}

export interface EmployeeContractMutationResult {
  contract: EmployeeContract;
  source_contract: EmployeeContract | null;
  replayed: boolean;
}

export interface EmployeeContractImportNormalizedPayload {
  employee_code: string;
  contract_number: string;
  contract_type: EmployeeContractType | null;
  start_date: LocalDate;
  end_date: LocalDate | null;
  lifecycle_state: EmployeeContractImportLifecycleState | null;
  lifecycle_date: LocalDate | null;
  lifecycle_reason: string | null;
  pdf_file_name: string | null;
  notes: string | null;
}

export interface EmployeeContractImportBatch
  extends SoftDeletable, ISOTimestamped {
  id: string;
  template_version: string;
  source_file_name: string;
  source_file_path: string;
  source_file_checksum: string;
  upload_session_id: string;
  status: EmployeeContractImportBatchStatus;
  workplace_warehouse_ids: string[];
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  committed_rows: number;
  failed_rows: number;
  created_by: string;
  committed_by: string | null;
  committed_at: Date | null;
  failure_message: LocalizedText | null;
  commit_idempotency_key: string | null;
}

export interface EmployeeContractImportStagedDocument {
  original_file_name: string;
  storage_path: string;
  storage_generation: string;
  file_size: number;
  sha256: string;
  mime_type: "application/pdf";
}

export interface EmployeeContractImportRow
  extends SoftDeletable, ISOTimestamped {
  id: string;
  batch_id: string;
  row_number: number;
  source_reference: string;
  employee_code: string;
  employee_profile_id: string | null;
  workplace_warehouse_id: string | null;
  normalized_payload: EmployeeContractImportNormalizedPayload;
  status: EmployeeContractImportRowStatus;
  validation_messages: LocalizedText[];
  staged_document: EmployeeContractImportStagedDocument | null;
  contract_id: string | null;
  document_id: string | null;
  error_code: string | null;
  committed_at: Date | null;
}

export interface EmployeeContractImportRowView
  extends EmployeeContractImportRow {
  employee_name: string | null;
  is_valid: boolean;
}

export interface EmployeeContractImportBatchView {
  batch: EmployeeContractImportBatch;
  rows: EmployeeContractImportRowView[];
}

export interface EmployeeContractImportUploadFileInput {
  original_file_name: string;
  kind: "EXCEL" | "PDF";
}

export interface CreateEmployeeContractImportUploadSessionInput {
  files: EmployeeContractImportUploadFileInput[];
  idempotency_key: string;
  action_time: Date;
}

export interface EmployeeContractImportSignedUpload {
  original_file_name: string;
  kind: "EXCEL" | "PDF";
  storage_path: string;
  method: "POST";
  upload_url: string;
  fields: Record<string, string>;
  expires_at: Date;
  max_file_size: number;
}

export interface EmployeeContractImportUploadSession {
  id: string;
  uploads: EmployeeContractImportSignedUpload[];
  expires_at: Date;
}

export interface EmployeeContractImportUploadedPdf {
  original_file_name: string;
  storage_path: string;
  sha256: string;
}

export interface PreviewEmployeeContractImportInput {
  upload_session_id: string;
  source_file_name: string;
  source_file_path: string;
  source_file_checksum: string;
  pdf_files: EmployeeContractImportUploadedPdf[];
  action_time: Date;
}

export interface CommitEmployeeContractImportInput {
  expected_batch_checksum: string;
  idempotency_key: string;
  action_time: Date;
}

export interface EmployeeContractImportCommitResult {
  batch: EmployeeContractImportBatch;
  committed_rows: number;
  duplicate_rows: number;
}
