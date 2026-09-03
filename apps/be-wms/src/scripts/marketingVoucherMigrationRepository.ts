import {
  AuditAction,
  MARKETING_VOUCHER_CAMPAIGNS_COLLECTION,
  MARKETING_VOUCHER_CODES_COLLECTION,
  MARKETING_VOUCHER_MIGRATIONS_COLLECTION,
  MARKETING_VOUCHER_MIGRATION_REPORTS_COLLECTION,
  type MarketingVoucherCampaign,
  type MarketingVoucherCode,
  type MarketingVoucherMigrationReport,
} from "@bduck/shared-types";
import {
  FieldPath,
  type Firestore,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";

import { migrationSha256 } from "./marketingVoucherMigrationPolicy.js";
import type {
  LegacyVoucherCampaign,
  LegacyVoucherCode,
  MigrationCheckpoint,
} from "./marketingVoucherMigrationTypes.js";

export interface LegacyDocument<T> {
  id: string;
  data: T;
}

export const readLegacyCampaigns = async (
  source: Firestore,
): Promise<Array<LegacyDocument<LegacyVoucherCampaign>>> => {
  const snapshot = await source
    .collection("voucher_campaigns")
    .orderBy(FieldPath.documentId())
    .get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    data: document.data() as LegacyVoucherCampaign,
  }));
};

const pageAfter = <T extends FirebaseFirestore.Query>(
  query: T,
  cursor: string | null,
): T => (cursor ? query.startAfter(cursor) : query) as T;

export const readLegacyCodePage = async (
  source: Firestore,
  cursor: string | null,
  limit: number,
): Promise<Array<LegacyDocument<LegacyVoucherCode>>> => {
  const query = source
    .collection("voucher_codes")
    .orderBy(FieldPath.documentId());
  const snapshot = await pageAfter(query, cursor).limit(limit).get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    data: document.data() as LegacyVoucherCode,
  }));
};

export const readLegacyStaffNames = async (
  source: Firestore,
  ids: string[],
): Promise<Map<string, string>> => {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return new Map();
  const snapshots = await source.getAll(
    ...unique.map((id) => source.collection("users").doc(id)),
  );
  return new Map(
    snapshots
      .filter((snapshot) => snapshot.exists)
      .map((snapshot) => [
        snapshot.id,
        String(snapshot.get("name") ?? snapshot.id),
      ]),
  );
};

const countCollection = async (
  db: Firestore,
  collection: string,
): Promise<number> =>
  (await db.collection(collection).count().get()).data().count;

export const readTargetCounts = async (target: Firestore) => ({
  campaigns: await countCollection(
    target,
    MARKETING_VOUCHER_CAMPAIGNS_COLLECTION,
  ),
  codes: await countCollection(target, MARKETING_VOUCHER_CODES_COLLECTION),
});

export const readMigrationCheckpoint = async (
  target: Firestore,
  migrationId: string,
): Promise<MigrationCheckpoint | null> => {
  const snapshot = await target
    .collection(MARKETING_VOUCHER_MIGRATIONS_COLLECTION)
    .doc(migrationId)
    .get();
  return snapshot.exists ? (snapshot.data() as MigrationCheckpoint) : null;
};

export const assertTargetBelongsToMigration = async (
  target: Firestore,
  migrationId: string,
): Promise<void> => {
  const totals = await readTargetCounts(target);
  const [campaignMatches, codeMatches] = await Promise.all([
    target
      .collection(MARKETING_VOUCHER_CAMPAIGNS_COLLECTION)
      .where("legacy_metadata.migration_id", "==", migrationId)
      .count()
      .get(),
    target
      .collection(MARKETING_VOUCHER_CODES_COLLECTION)
      .where("legacy_metadata.migration_id", "==", migrationId)
      .count()
      .get(),
  ]);
  if (
    campaignMatches.data().count !== totals.campaigns ||
    codeMatches.data().count !== totals.codes
  ) {
    throw new Error("TARGET_CONTAINS_DATA_OUTSIDE_MIGRATION");
  }
};

const migrationAudit = (input: {
  id: string;
  actorId: string;
  entityId: string;
  actionTime: Date;
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown>;
  notes: string;
}) => ({
  id: input.id,
  entity_type: MARKETING_VOUCHER_MIGRATIONS_COLLECTION,
  entity_id: input.entityId,
  warehouse_id: null,
  action: AuditAction.MARKETING_VOUCHER_MIGRATION_RUN,
  user_id: input.actorId,
  user_name: null,
  entity_name: input.entityId,
  action_time: input.actionTime,
  sync_time: new Date(),
  old_value: input.oldValue,
  new_value: input.newValue,
  ip_address: null,
  device_id: null,
  session_token: null,
  notes: input.notes,
});

export const initializeTargetMigration = async (
  target: Firestore,
  campaigns: MarketingVoucherCampaign[],
  checkpoint: MigrationCheckpoint,
): Promise<void> => {
  const references = campaigns.map((campaign) =>
    target.collection(MARKETING_VOUCHER_CAMPAIGNS_COLLECTION).doc(campaign.id),
  );
  const existing = await target.getAll(...references);
  for (const snapshot of existing) {
    if (!snapshot.exists) continue;
    if (
      snapshot.get("legacy_metadata.migration_id") !== checkpoint.id ||
      snapshot.get("legacy_metadata.source_hash") !==
        campaigns.find((campaign) => campaign.id === snapshot.id)
          ?.legacy_metadata?.source_hash
    ) {
      throw new Error(`TARGET_CAMPAIGN_CONFLICT:${snapshot.id}`);
    }
  }
  const batch = target.batch();
  campaigns.forEach((campaign, index) => {
    if (!existing[index]?.exists) batch.create(references[index]!, campaign);
  });
  batch.create(
    target
      .collection(MARKETING_VOUCHER_MIGRATIONS_COLLECTION)
      .doc(checkpoint.id),
    checkpoint,
  );
  const auditId = migrationSha256(`${checkpoint.id}:initialize`);
  batch.create(
    target.collection("audit_logs").doc(auditId),
    migrationAudit({
      id: auditId,
      actorId: checkpoint.actor_id,
      entityId: checkpoint.id,
      actionTime: checkpoint.action_time,
      oldValue: null,
      newValue: {
        stage: checkpoint.stage,
        source_project_id: checkpoint.source_project_id,
        target_project_id: checkpoint.target_project_id,
        campaign_count: campaigns.length,
      },
      notes: "Marketing voucher migration rehearsal initialized",
    }),
  );
  await batch.commit();
};

const isAlreadyExistsError = (error: unknown): boolean => {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = (error as { code?: unknown }).code;
  return code === 6 || code === "already-exists" || code === "ALREADY_EXISTS";
};

export const writeTargetCodeGroup = async (input: {
  target: Firestore;
  migrationId: string;
  actorId: string;
  actionTime: Date;
  codes: MarketingVoucherCode[];
  checkpoint: MigrationCheckpoint;
  disableThrottling: boolean;
}): Promise<number> => {
  const initialOpsPerSecond = Math.min(
    5_000,
    Math.max(
      100,
      Number(process.env.MARKETING_VOUCHER_MIGRATION_INITIAL_WRITES_PER_SECOND ?? 2_000),
    ),
  );
  const maxOpsPerSecond = Math.min(
    10_000,
    Math.max(
      initialOpsPerSecond,
      Number(process.env.MARKETING_VOUCHER_MIGRATION_MAX_WRITES_PER_SECOND ?? 5_000),
    ),
  );
  const writer = input.target.bulkWriter({
    throttling:
      !input.disableThrottling
        ? { initialOpsPerSecond, maxOpsPerSecond }
        : false,
  });
  let written = 0;
  const writes = input.codes.map(async (code) => {
    const reference = input.target
      .collection(MARKETING_VOUCHER_CODES_COLLECTION)
      .doc(code.id);
    try {
      await writer.create(reference, code);
      written += 1;
    } catch (error) {
      if (!isAlreadyExistsError(error)) throw error;
      const existing = await reference.get();
      if (
        !existing.exists ||
        existing.get("legacy_metadata.migration_id") !== input.migrationId ||
        existing.get("source_hash") !== code.source_hash
      ) {
        throw new Error(`TARGET_CODE_CONFLICT:${code.id}`);
      }
    }
  });
  const settledWrites = Promise.all(writes);
  await writer.close();
  await settledWrites;
  const cursor = input.checkpoint.code_cursor ?? "empty";
  const auditId = migrationSha256(`${input.migrationId}:codes:${cursor}`);
  const batch = input.target.batch();
  batch.set(
    input.target
      .collection(MARKETING_VOUCHER_MIGRATIONS_COLLECTION)
      .doc(input.migrationId),
    input.checkpoint,
    { merge: true },
  );
  batch.create(
    input.target.collection("audit_logs").doc(auditId),
    migrationAudit({
      id: auditId,
      actorId: input.actorId,
      entityId: input.migrationId,
      actionTime: input.actionTime,
      oldValue: null,
      newValue: {
        stage: "CODES",
        cursor,
        processed_code_count: input.checkpoint.processed_code_count,
        source_checksum: input.checkpoint.source_checksum,
        attempted: input.codes.length,
        written,
      },
      notes: "Marketing voucher migration bulk-writer checkpoint",
    }),
  );
  await batch.commit();
  return written;
};

export const finalizeTargetMigration = async (input: {
  target: Firestore;
  campaigns: MarketingVoucherCampaign[];
  checkpoint: MigrationCheckpoint;
  report: MarketingVoucherMigrationReport;
}): Promise<void> => {
  const now = new Date();
  const batch = input.target.batch();
  input.campaigns.forEach((campaign) => {
    batch.set(
      input.target
        .collection(MARKETING_VOUCHER_CAMPAIGNS_COLLECTION)
        .doc(campaign.id),
      campaign,
    );
  });
  batch.set(
    input.target
      .collection(MARKETING_VOUCHER_MIGRATIONS_COLLECTION)
      .doc(input.checkpoint.id),
    {
      ...input.checkpoint,
      status: input.report.status,
      stage: input.report.status === "COMPLETED" ? "COMPLETED" : "RECONCILE",
      updated_at: now,
      sync_time: now,
    },
    { merge: true },
  );
  const reportId = `${input.report.migration_id}-${input.report.mode.toLowerCase()}`;
  batch.set(
    input.target
      .collection(MARKETING_VOUCHER_MIGRATION_REPORTS_COLLECTION)
      .doc(reportId),
    input.report,
  );
  const auditId = migrationSha256(
    `${input.checkpoint.id}:final:${input.report.status}`,
  );
  batch.create(
    input.target.collection("audit_logs").doc(auditId),
    migrationAudit({
      id: auditId,
      actorId: input.checkpoint.actor_id,
      entityId: input.checkpoint.id,
      actionTime: input.checkpoint.action_time,
      oldValue: { status: "RUNNING" },
      newValue: {
        status: input.report.status,
        campaign_count: input.report.target_campaign_count,
        code_count: input.report.target_code_count,
        checksum: input.report.target_checksum,
      },
      notes: `Marketing voucher migration rehearsal ${input.report.status.toLowerCase()}`,
    }),
  );
  await batch.commit();
};

export const stageTargetCampaignFinalData = async (input: {
  target: Firestore;
  campaigns: MarketingVoucherCampaign[];
  checkpoint: MigrationCheckpoint;
}): Promise<void> => {
  const now = new Date();
  const batch = input.target.batch();
  input.campaigns.forEach((campaign) => {
    batch.set(
      input.target
        .collection(MARKETING_VOUCHER_CAMPAIGNS_COLLECTION)
        .doc(campaign.id),
      campaign,
    );
  });
  batch.set(
    input.target
      .collection(MARKETING_VOUCHER_MIGRATIONS_COLLECTION)
      .doc(input.checkpoint.id),
    { stage: "RECONCILE", updated_at: now, sync_time: now },
    { merge: true },
  );
  await batch.commit();
};

export const markTargetMigrationFailed = async (
  target: Firestore,
  migrationId: string,
  error: string,
): Promise<void> => {
  const now = new Date();
  await target
    .collection(MARKETING_VOUCHER_MIGRATIONS_COLLECTION)
    .doc(migrationId)
    .set(
      { status: "FAILED", last_error: error, updated_at: now, sync_time: now },
      { merge: true },
    );
};

export const readTargetCampaigns = async (
  target: Firestore,
): Promise<QueryDocumentSnapshot[]> =>
  (
    await target
      .collection(MARKETING_VOUCHER_CAMPAIGNS_COLLECTION)
      .orderBy(FieldPath.documentId())
      .get()
  ).docs;

export const readTargetCodePage = async (
  target: Firestore,
  cursor: string | null,
  limit: number,
): Promise<QueryDocumentSnapshot[]> => {
  const query = target
    .collection(MARKETING_VOUCHER_CODES_COLLECTION)
    .orderBy(FieldPath.documentId());
  return (await pageAfter(query, cursor).limit(limit).get()).docs;
};
