import type { ISOTimestamped, LocalDate, SoftDeletable } from "./utility.js";

export const MARKETING_VOUCHER_CAMPAIGNS_COLLECTION =
  "marketing_voucher_campaigns" as const;
export const MARKETING_VOUCHER_CODES_COLLECTION =
  "marketing_voucher_codes" as const;
export const MARKETING_VOUCHER_JOBS_COLLECTION =
  "marketing_voucher_jobs" as const;
export const MARKETING_VOUCHER_JOB_ITEMS_SUBCOLLECTION = "items" as const;
export const MARKETING_VOUCHER_MIGRATIONS_COLLECTION =
  "marketing_voucher_migrations" as const;
export const MARKETING_VOUCHER_MIGRATION_REPORTS_COLLECTION =
  "marketing_voucher_migration_reports" as const;
export const MARKETING_VOUCHER_CODE_ALPHABET_SIZE = 32;

export const getMarketingVoucherSafeCodeCapacity = (
  codeLength: number,
): number => Math.floor(MARKETING_VOUCHER_CODE_ALPHABET_SIZE ** codeLength / 4);

export const resolveMarketingVouchersFeatureEnabled = (
  value: string | undefined,
): boolean => {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return false;
  if (["1", "true", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "off", "disabled"].includes(normalized)) return false;
  throw new Error("MARKETING_VOUCHERS_FEATURE_ENABLED_INVALID");
};

export const MARKETING_VOUCHER_PERMISSION_KEYS = [
  "marketing_vouchers.read",
  "marketing_vouchers.campaigns.write",
  "marketing_vouchers.codes.generate",
  "marketing_vouchers.codes.revoke",
  "marketing_vouchers.campaigns.extend",
  "marketing_vouchers.export",
  "marketing_vouchers.appearance.write",
  "marketing_vouchers.email.send",
] as const;

export type MarketingVoucherPermission =
  (typeof MARKETING_VOUCHER_PERMISSION_KEYS)[number];

export const MARKETING_VOUCHER_REWARD_TYPES = [
  "DISCOUNT_PERCENT",
  "DISCOUNT_FIXED",
  "FREE_TICKET",
  "FREE_ITEM",
] as const;
export type MarketingVoucherRewardType =
  (typeof MARKETING_VOUCHER_REWARD_TYPES)[number];

export const MARKETING_VOUCHER_CAMPAIGN_STATUSES = [
  "GENERATING",
  "ACTIVE",
  "PAUSED",
  "ENDED",
  "GENERATION_FAILED",
] as const;
export type MarketingVoucherCampaignStatus =
  (typeof MARKETING_VOUCHER_CAMPAIGN_STATUSES)[number];

export const MARKETING_VOUCHER_CODE_STATUSES = [
  "AVAILABLE",
  "DISTRIBUTED",
  "USED",
  "REVOKED",
] as const;
export type MarketingVoucherCodeStatus =
  (typeof MARKETING_VOUCHER_CODE_STATUSES)[number];

export type MarketingVoucherEffectiveStatus =
  | MarketingVoucherCodeStatus
  | "PAUSED"
  | "EXPIRED";
export type MarketingVoucherCampaignPurpose = "EVENT" | "PRINT";

export interface MarketingVoucherCodeCounts {
  available: number;
  distributed: number;
  used: number;
  revoked: number;
  total: number;
}

export interface MarketingVoucherLegacyMetadata {
  source_project_id: string;
  source_collection: string;
  source_document_id: string;
  migration_id: string;
  migrated_at: Date;
  source_total_issued?: number | null;
  purpose_defaulted?: boolean;
  source_actor_id?: string | null;
  source_hash?: string;
  source_image_sha256?: string | null;
  target_image_sha256?: string | null;
}

export interface MarketingVoucherCampaign
  extends SoftDeletable, ISOTimestamped {
  id: string;
  name: string;
  description: string;
  reward_type: MarketingVoucherRewardType;
  reward_value: number;
  valid_from: LocalDate;
  valid_to: LocalDate;
  prefix: string;
  code_length: number;
  suffix: string;
  purpose: MarketingVoucherCampaignPurpose;
  status: MarketingVoucherCampaignStatus;
  accent_color: string;
  image_storage_path: string | null;
  image_url: string | null;
  code_counts: MarketingVoucherCodeCounts;
  total_issued: number;
  active_generation_job_id: string | null;
  active_extension_job_id: string | null;
  active_export_job_id: string | null;
  revision: number;
  created_by: string;
  updated_by: string;
  legacy_metadata: MarketingVoucherLegacyMetadata | null;
}

export interface MarketingVoucherCode extends SoftDeletable, ISOTimestamped {
  id: string;
  campaign_id: string;
  campaign_name: string;
  reward_type: MarketingVoucherRewardType;
  reward_value: number;
  valid_to: LocalDate;
  status: MarketingVoucherCodeStatus;
  distributed_to_phone: string | null;
  distributed_at: Date | null;
  used_at: Date | null;
  used_by_staff_id: string | null;
  used_by_staff_name: string | null;
  emailed_at: Date | null;
  emailed_to: string | null;
  revoked_at: Date | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  source_hash: string;
  revision: number;
  created_by: string;
  updated_by: string;
  legacy_metadata: MarketingVoucherLegacyMetadata | null;
}

export const MARKETING_VOUCHER_JOB_TYPES = [
  "GENERATE_CODES",
  "EXTEND_EXPIRY",
  "EXPORT_EXCEL",
  "SEND_EMAIL",
] as const;
export type MarketingVoucherJobType =
  (typeof MARKETING_VOUCHER_JOB_TYPES)[number];

export const MARKETING_VOUCHER_JOB_STATUSES = [
  "QUEUED",
  "PROCESSING",
  "PAUSED",
  "COMPLETED",
  "PARTIAL",
  "FAILED",
  "CANCELLED",
] as const;
export type MarketingVoucherJobStatus =
  (typeof MARKETING_VOUCHER_JOB_STATUSES)[number];

export interface MarketingVoucherJobProgress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
}

export type MarketingVoucherExportLocale = "vi" | "zh";

export interface MarketingVoucherExportPart {
  index: number;
  file_name: string;
  storage_path: string;
  row_count: number;
  checksum: string;
  size_bytes: number;
}

export interface MarketingVoucherExportManifest {
  version: 1;
  campaign_id: string;
  campaign_name: string;
  job_id: string;
  locale: MarketingVoucherExportLocale;
  generated_at: Date;
  total_rows: number;
  part_count: number;
  format: "XLSX" | "ZIP";
  files: MarketingVoucherExportPart[];
}

export interface MarketingVoucherJob extends SoftDeletable, ISOTimestamped {
  id: string;
  type: MarketingVoucherJobType;
  status: MarketingVoucherJobStatus;
  campaign_id: string;
  generation_mode: "INITIAL" | "APPEND" | null;
  target_valid_to: LocalDate | null;
  email_subject: string | null;
  email_introduction: string | null;
  idempotency_key: string;
  cursor: string | null;
  progress: MarketingVoucherJobProgress;
  requested_by: string;
  last_error_code: string | null;
  last_error_message: string | null;
  output_storage_path: string | null;
  output_checksum: string | null;
  output_file_name: string | null;
  output_content_type: string | null;
  output_size_bytes: number | null;
  output_manifest_storage_path: string | null;
  export_locale: MarketingVoucherExportLocale | null;
  export_parts: MarketingVoucherExportPart[];
  export_manifest: MarketingVoucherExportManifest | null;
  attempt_count: number;
  completed_at: Date | null;
  revision: number;
}

export interface MarketingVoucherExportDownload {
  url: string;
  file_name: string;
  content_type: string;
  checksum: string;
  expires_at: Date;
  manifest: MarketingVoucherExportManifest;
}

export interface MarketingVoucherMutationResult<T> {
  value: T;
  replayed: boolean;
}

export interface MarketingVoucherCampaignMutationResult {
  campaign: MarketingVoucherCampaign;
  job: MarketingVoucherJob | null;
  replayed: boolean;
}

export interface MarketingVoucherCodePage {
  items: MarketingVoucherCode[];
  next_cursor: string | null;
}

export interface MarketingVoucherCampaignPage {
  items: MarketingVoucherCampaign[];
  next_cursor: string | null;
}

export interface MarketingVoucherJobPage {
  items: MarketingVoucherJob[];
  next_cursor: string | null;
}

export type MarketingVoucherJobItemStatus =
  | "QUEUED"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

export interface MarketingVoucherJobItem extends SoftDeletable, ISOTimestamped {
  id: string;
  job_id: string;
  campaign_id: string;
  voucher_code_ids: string[];
  recipient_email: string | null;
  status: MarketingVoucherJobItemStatus;
  attempt_count: number;
  last_error_code: string | null;
  last_error_message: string | null;
  brevo_message_id: string | null;
  completed_at: Date | null;
}

export const MARKETING_VOUCHER_MIGRATION_MODES = [
  "DRY_RUN",
  "APPLY",
  "RESUME",
  "VERIFY",
  "RECONCILE",
] as const;
export type MarketingVoucherMigrationMode =
  (typeof MARKETING_VOUCHER_MIGRATION_MODES)[number];

export const MARKETING_VOUCHER_MIGRATION_STATUSES = [
  "RUNNING",
  "COMPLETED",
  "FAILED",
] as const;
export type MarketingVoucherMigrationStatus =
  (typeof MARKETING_VOUCHER_MIGRATION_STATUSES)[number];

export interface MarketingVoucherMigrationCampaignReport {
  campaign_id: string;
  source_declared_total: number;
  source_actual_total: number;
  target_actual_total: number | null;
  source_counts: MarketingVoucherCodeCounts;
  target_counts: MarketingVoucherCodeCounts | null;
  source_checksum: string;
  target_checksum: string | null;
  purpose_defaulted: boolean;
  source_image_sha256: string | null;
  target_image_sha256: string | null;
  issues: string[];
}

export interface MarketingVoucherMigrationReport {
  version: 1;
  migration_id: string;
  mode: MarketingVoucherMigrationMode;
  status: MarketingVoucherMigrationStatus;
  source_project_id: string;
  target_project_id: string | null;
  pii_redacted: boolean;
  source_campaign_count: number;
  target_campaign_count: number | null;
  source_code_count: number;
  target_code_count: number | null;
  source_checksum: string;
  target_checksum: string | null;
  duplicate_or_conflicting_code_count: number;
  image_success_count: number;
  image_failure_count: number;
  uat_campaign_ids: string[];
  uat_passed: boolean | null;
  uat_issues: string[];
  campaigns: MarketingVoucherMigrationCampaignReport[];
  issues: string[];
  started_at: Date;
  completed_at: Date;
}
