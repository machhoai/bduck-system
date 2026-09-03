import { createHash } from "node:crypto";

import type {
  MarketingVoucherCampaign,
  MarketingVoucherCodeCounts,
  MarketingVoucherCodeStatus,
  MarketingVoucherRewardType,
} from "@bduck/shared-types";

import type {
  LegacyVoucherCampaign,
  LegacyVoucherCode,
  MigrationImageResult,
  TransformedCode,
} from "./marketingVoucherMigrationTypes.js";

const DEFAULT_ACCENT_COLOR = "#F59E0B";
const emptyCounts = (): MarketingVoucherCodeCounts => ({
  available: 0,
  distributed: 0,
  used: 0,
  revoked: 0,
  total: 0,
});

const stableValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, item]) => item !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableValue(item)]),
    );
  }
  return value;
};

export const migrationSha256 = (value: string | Buffer): string =>
  createHash("sha256").update(value).digest("hex");

export const canonicalHash = (value: unknown): string =>
  migrationSha256(JSON.stringify(stableValue(value)));

export const appendMigrationChecksum = (
  checksum: string,
  documentId: string,
  documentHash: string,
): string => migrationSha256(`${checksum}\n${documentId}:${documentHash}`);

const text = (value: unknown, fallback = ""): string =>
  typeof value === "string" ? value.trim() : fallback;
const number = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const dateOnly = (value: unknown): string => {
  const raw = text(value);
  const match = /^\d{4}-\d{2}-\d{2}/u.exec(raw);
  if (!match) throw new Error(`LEGACY_DATE_INVALID:${raw || "EMPTY"}`);
  return match[0];
};
const date = (value: unknown, fallback: Date): Date => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate?: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(text(value));
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
};
const nullableDate = (value: unknown): Date | null =>
  value == null || value === "" ? null : date(value, new Date(0));

const rewardType = (value: unknown): MarketingVoucherRewardType => {
  const map: Record<string, MarketingVoucherRewardType> = {
    discount_percent: "DISCOUNT_PERCENT",
    discount_fixed: "DISCOUNT_FIXED",
    free_ticket: "FREE_TICKET",
    free_item: "FREE_ITEM",
  };
  const mapped = map[text(value).toLowerCase()];
  if (!mapped) throw new Error(`LEGACY_REWARD_TYPE_INVALID:${String(value)}`);
  return mapped;
};

export const mapLegacyCodeStatus = (
  value: unknown,
): { status: MarketingVoucherCodeStatus; issue: string | null } => {
  const normalized = text(value).toLowerCase();
  if (normalized === "available") return { status: "AVAILABLE", issue: null };
  if (normalized === "distributed") {
    return { status: "DISTRIBUTED", issue: null };
  }
  if (normalized === "used") return { status: "USED", issue: null };
  if (normalized === "revoked") return { status: "REVOKED", issue: null };
  if (normalized === "expired") {
    return { status: "AVAILABLE", issue: "LEGACY_EXPIRED_MAPPED_TO_AVAILABLE" };
  }
  throw new Error(`LEGACY_CODE_STATUS_INVALID:${String(value)}`);
};

export const incrementMigrationCount = (
  counts: MarketingVoucherCodeCounts,
  status: MarketingVoucherCodeStatus,
): void => {
  counts[
    status.toLowerCase() as keyof Omit<MarketingVoucherCodeCounts, "total">
  ] += 1;
  counts.total += 1;
};

const redact = (kind: string, value: string): string =>
  `${kind}-${migrationSha256(value).slice(0, 16)}`;
const redactEmail = (value: string): string =>
  `voucher+${migrationSha256(value.toLowerCase()).slice(0, 16)}@example.invalid`;

export const transformLegacyCode = (input: {
  id: string;
  source: LegacyVoucherCode;
  migrationId: string;
  sourceProjectId: string;
  actorId: string;
  syncTime: Date;
  staffName: string | null;
  redactPii: boolean;
}): TransformedCode => {
  const source = { ...input.source, id: input.id };
  const mappedStatus = mapLegacyCodeStatus(source.status);
  const sourceHash = canonicalHash(source);
  const sourceStaffId = text(source.usedByStaffId) || null;
  const phone = text(source.distributedToPhone) || null;
  const email = text(source.emailedTo) || null;
  const createdAt = input.syncTime;
  return {
    source_hash: sourceHash,
    issue: mappedStatus.issue,
    code: {
      id: input.id,
      campaign_id: text(source.campaignId),
      campaign_name: text(source.campaignName),
      reward_type: rewardType(source.rewardType),
      reward_value: number(source.rewardValue),
      valid_to: dateOnly(source.validTo),
      status: mappedStatus.status,
      distributed_to_phone:
        input.redactPii && phone ? redact("phone", phone) : phone,
      distributed_at: nullableDate(source.distributedAt),
      used_at: nullableDate(source.usedAt),
      used_by_staff_id:
        input.redactPii && sourceStaffId
          ? redact("staff", sourceStaffId)
          : sourceStaffId,
      used_by_staff_name:
        input.redactPii && input.staffName ? "[REDACTED]" : input.staffName,
      emailed_at: nullableDate(source.emailedAt),
      emailed_to: input.redactPii && email ? redactEmail(email) : email,
      revoked_at: mappedStatus.status === "REVOKED" ? createdAt : null,
      revoked_by: null,
      revoke_reason: mappedStatus.status === "REVOKED" ? "Legacy status" : null,
      source_hash: sourceHash,
      revision: 1,
      created_by: input.actorId,
      updated_by: input.actorId,
      legacy_metadata: {
        source_project_id: input.sourceProjectId,
        source_collection: "voucher_codes",
        source_document_id: input.id,
        migration_id: input.migrationId,
        migrated_at: input.syncTime,
        source_actor_id:
          input.redactPii && sourceStaffId
            ? redact("staff", sourceStaffId)
            : sourceStaffId,
        source_hash: sourceHash,
      },
      is_deleted: false,
      created_at: createdAt,
      updated_at: createdAt,
      action_time: createdAt,
      sync_time: createdAt,
    },
  };
};

export const transformLegacyCampaign = (input: {
  id: string;
  source: LegacyVoucherCampaign;
  migrationId: string;
  sourceProjectId: string;
  actorId: string;
  syncTime: Date;
  counts?: MarketingVoucherCodeCounts;
  image?: MigrationImageResult;
  redactPii: boolean;
}): MarketingVoucherCampaign => {
  const source = input.source;
  const purpose = text(source.purpose).toLowerCase();
  const statusMap = {
    active: "ACTIVE",
    paused: "PAUSED",
    ended: "ENDED",
  } as const;
  const status =
    statusMap[text(source.status).toLowerCase() as keyof typeof statusMap];
  if (!status)
    throw new Error(`LEGACY_CAMPAIGN_STATUS_INVALID:${String(source.status)}`);
  const createdAt = date(source.createdAt, input.syncTime);
  const sourceActorId = text(source.createdBy) || null;
  return {
    id: input.id,
    name: text(source.name),
    description: text(source.description),
    reward_type: rewardType(source.rewardType),
    reward_value: number(source.rewardValue),
    valid_from: dateOnly(source.validFrom),
    valid_to: dateOnly(source.validTo),
    prefix: text(source.prefix).toUpperCase(),
    code_length: number(source.codeLength, 6),
    suffix: text(source.suffix).toUpperCase(),
    purpose: purpose === "print" ? "PRINT" : "EVENT",
    status,
    accent_color: DEFAULT_ACCENT_COLOR,
    image_storage_path: input.image?.storage_path ?? null,
    image_url: input.image?.download_url ?? null,
    code_counts: input.counts ?? emptyCounts(),
    total_issued: input.counts?.total ?? 0,
    active_generation_job_id: null,
    active_extension_job_id: null,
    active_export_job_id: null,
    revision: 1,
    created_by: input.actorId,
    updated_by: input.actorId,
    legacy_metadata: {
      source_project_id: input.sourceProjectId,
      source_collection: "voucher_campaigns",
      source_document_id: input.id,
      migration_id: input.migrationId,
      migrated_at: input.syncTime,
      source_total_issued: number(source.totalIssued),
      purpose_defaulted: purpose !== "print" && purpose !== "event",
      source_actor_id:
        input.redactPii && sourceActorId
          ? redact("staff", sourceActorId)
          : sourceActorId,
      source_hash: canonicalHash({ ...source, id: input.id }),
      source_image_sha256: input.image?.source_sha256 ?? null,
      target_image_sha256: input.image?.target_sha256 ?? null,
    },
    is_deleted: false,
    created_at: createdAt,
    updated_at: input.syncTime,
    action_time: createdAt,
    sync_time: input.syncTime,
  };
};

export const createEmptyMigrationCounts = emptyCounts;
