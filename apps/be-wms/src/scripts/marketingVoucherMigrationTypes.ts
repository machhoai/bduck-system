import type {
  MarketingVoucherCampaign,
  MarketingVoucherCode,
  MarketingVoucherCodeCounts,
  MarketingVoucherMigrationMode,
  MarketingVoucherMigrationReport,
} from "@bduck/shared-types";

export interface LegacyVoucherCampaign {
  id?: unknown;
  name?: unknown;
  description?: unknown;
  rewardType?: unknown;
  rewardValue?: unknown;
  validFrom?: unknown;
  validTo?: unknown;
  prefix?: unknown;
  codeLength?: unknown;
  suffix?: unknown;
  totalIssued?: unknown;
  status?: unknown;
  purpose?: unknown;
  image?: unknown;
  createdAt?: unknown;
  createdBy?: unknown;
}

export interface LegacyVoucherCode {
  id?: unknown;
  campaignId?: unknown;
  campaignName?: unknown;
  rewardType?: unknown;
  rewardValue?: unknown;
  validTo?: unknown;
  status?: unknown;
  distributedToPhone?: unknown;
  distributedAt?: unknown;
  usedAt?: unknown;
  usedByStaffId?: unknown;
  emailedAt?: unknown;
  emailedTo?: unknown;
}

export interface SourceCampaignScan {
  source: LegacyVoucherCampaign;
  id: string;
  source_hash: string;
  declared_total: number;
  counts: MarketingVoucherCodeCounts;
  checksum: string;
  image_url: string | null;
}

export interface MigrationImageResult {
  storage_path: string | null;
  download_url: string | null;
  source_sha256: string | null;
  target_sha256: string | null;
  error: string | null;
}

export interface MarketingVoucherMigrationOptions {
  mode: MarketingVoucherMigrationMode;
  migrationId: string;
  actorId: string;
  batchSize: number;
  sourceProjectConfirmation: string;
  targetProjectConfirmation: string | null;
  redactPii: boolean;
  expectedCampaigns: number;
  expectedCodes: number;
  reportDirectory: string;
}

export interface MigrationCheckpoint {
  id: string;
  source_project_id: string;
  target_project_id: string;
  status: "RUNNING" | "COMPLETED" | "FAILED";
  stage: "CAMPAIGNS" | "CODES" | "IMAGES" | "RECONCILE" | "COMPLETED";
  code_cursor: string | null;
  processed_code_count: number;
  source_checksum: string;
  campaign_counts: Record<string, MarketingVoucherCodeCounts>;
  campaign_checksums: Record<string, string>;
  pii_redacted: boolean;
  actor_id: string;
  is_deleted: false;
  action_time: Date;
  sync_time: Date;
  created_at: Date;
  updated_at: Date;
}

export interface MigrationRuntime {
  options: MarketingVoucherMigrationOptions;
  sourceProjectId: string;
  targetProjectId: string | null;
  sourceCampaigns: Map<string, SourceCampaignScan>;
  checkpoint: MigrationCheckpoint | null;
}

export interface MigrationOutcome {
  report: MarketingVoucherMigrationReport;
  campaigns: MarketingVoucherCampaign[];
  codesWritten: number;
}

export interface TransformedCode {
  code: MarketingVoucherCode;
  source_hash: string;
  issue: string | null;
}
