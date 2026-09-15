import { createHash, randomUUID } from "crypto";

import type {
  PartnerCategoryMappingDto,
  PartnerInventoryComparisonSnapshot,
  PartnerInventorySyncJobDto,
  PartnerWarehouseMappingDto,
} from "@bduck/shared-types";

import { db } from "../config/firebase.js";

const WAREHOUSE_MAPPINGS = "partner_warehouse_mappings";
const WAREHOUSE_CLAIMS = "partner_warehouse_mapping_claims";
const CATEGORY_MAPPINGS = "partner_category_mappings";
const SNAPSHOTS = "partner_inventory_snapshots";
const JOBS = "partner_inventory_sync_jobs";

interface StoredWarehouseMapping
  extends Omit<PartnerWarehouseMappingDto, "created_at" | "updated_at"> {
  created_at: Date;
  updated_at: Date;
}

interface StoredCategoryMapping
  extends Omit<PartnerCategoryMappingDto, "created_at" | "updated_at"> {
  created_at: Date;
  updated_at: Date;
}

interface StoredSnapshot
  extends Omit<
    PartnerInventoryComparisonSnapshot,
    "fetched_at" | "expires_at"
  > {
  fetched_at: Date;
  expires_at: Date;
  created_by: string;
  is_deleted: boolean;
}

interface StoredJob
  extends Omit<
    PartnerInventorySyncJobDto,
    "action_time" | "sync_time" | "completed_at"
  > {
  action_time: Date;
  sync_time: Date;
  completed_at: Date | null;
  payload_fingerprint: string;
  is_deleted: boolean;
  updated_at: Date;
}

const mappingId = (connectionId: string, localId: string) =>
  `${connectionId}__${localId}`;

const claimId = (connectionId: string, partnerId: string) =>
  createHash("sha256").update(`${connectionId}\n${partnerId}`).digest("hex");

const toDate = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    return value.toDate();
  }
  if (value && typeof value === "object" && "seconds" in value) {
    return new Date(Number(value.seconds) * 1000);
  }
  return new Date(String(value));
};

const toIso = (value: unknown): string => toDate(value).toISOString();

const warehouseMappingDto = (
  value: StoredWarehouseMapping,
): PartnerWarehouseMappingDto => ({
  ...value,
  created_at: toIso(value.created_at),
  updated_at: toIso(value.updated_at),
});

const categoryMappingDto = (
  value: StoredCategoryMapping,
): PartnerCategoryMappingDto => ({
  ...value,
  created_at: toIso(value.created_at),
  updated_at: toIso(value.updated_at),
});

const snapshotDto = (
  value: StoredSnapshot,
): PartnerInventoryComparisonSnapshot => {
  const { created_by: _createdBy, is_deleted: _isDeleted, ...snapshot } = value;
  return {
    ...snapshot,
    fetched_at: toIso(value.fetched_at),
    expires_at: toIso(value.expires_at),
  };
};

const jobDto = (value: StoredJob): PartnerInventorySyncJobDto => {
  const {
    payload_fingerprint: _fingerprint,
    is_deleted: _isDeleted,
    updated_at: _updatedAt,
    ...job
  } = value;
  return {
    ...job,
    action_time: toIso(value.action_time),
    sync_time: toIso(value.sync_time),
    completed_at: value.completed_at ? toIso(value.completed_at) : null,
  };
};

export const findPartnerWarehouseMapping = async (
  connectionId: string,
  warehouseId: string,
): Promise<PartnerWarehouseMappingDto | null> => {
  const snapshot = await db
    .collection(WAREHOUSE_MAPPINGS)
    .doc(mappingId(connectionId, warehouseId))
    .get();
  if (!snapshot.exists) return null;
  const value = snapshot.data() as StoredWarehouseMapping;
  return value.is_deleted ? null : warehouseMappingDto(value);
};

export const savePartnerWarehouseMapping = async (input: {
  connectionId: string;
  warehouseId: string;
  partnerStockId: string;
  partnerStockName: string;
  actorId: string;
}): Promise<{
  before: PartnerWarehouseMappingDto | null;
  after: PartnerWarehouseMappingDto;
}> => {
  const id = mappingId(input.connectionId, input.warehouseId);
  const mappingRef = db.collection(WAREHOUSE_MAPPINGS).doc(id);
  const newClaimRef = db
    .collection(WAREHOUSE_CLAIMS)
    .doc(claimId(input.connectionId, input.partnerStockId));
  const now = new Date();

  return db.runTransaction(async (transaction) => {
    const [mappingSnapshot, claimSnapshot] = await Promise.all([
      transaction.get(mappingRef),
      transaction.get(newClaimRef),
    ]);
    const existing = mappingSnapshot.exists
      ? (mappingSnapshot.data() as StoredWarehouseMapping)
      : null;
    const claim = claimSnapshot.exists
      ? (claimSnapshot.data() as {
          warehouse_id: string;
          is_deleted: boolean;
        })
      : null;

    if (
      claim &&
      !claim.is_deleted &&
      claim.warehouse_id !== input.warehouseId
    ) {
      throw new Error("PARTNER_STOCK_ALREADY_MAPPED");
    }

    if (
      existing &&
      !existing.is_deleted &&
      existing.partner_stock_id !== input.partnerStockId
    ) {
      transaction.set(
        db
          .collection(WAREHOUSE_CLAIMS)
          .doc(claimId(input.connectionId, existing.partner_stock_id)),
        { is_deleted: true, updated_at: now, updated_by: input.actorId },
        { merge: true },
      );
    }

    const after: StoredWarehouseMapping = {
      id,
      connection_id: input.connectionId,
      warehouse_id: input.warehouseId,
      partner_stock_id: input.partnerStockId,
      partner_stock_name: input.partnerStockName,
      version: existing ? existing.version + 1 : 1,
      is_deleted: false,
      created_at: existing?.created_at ?? now,
      updated_at: now,
      updated_by: input.actorId,
    };
    transaction.set(mappingRef, after);
    transaction.set(newClaimRef, {
      id: newClaimRef.id,
      connection_id: input.connectionId,
      partner_stock_id: input.partnerStockId,
      warehouse_id: input.warehouseId,
      is_deleted: false,
      created_at: claimSnapshot.exists
        ? claimSnapshot.data()?.created_at ?? now
        : now,
      updated_at: now,
      updated_by: input.actorId,
    });

    return {
      before: existing && !existing.is_deleted ? warehouseMappingDto(existing) : null,
      after: warehouseMappingDto(after),
    };
  });
};

export const findPartnerCategoryMapping = async (
  connectionId: string,
  categoryId: string,
): Promise<PartnerCategoryMappingDto | null> => {
  const snapshot = await db
    .collection(CATEGORY_MAPPINGS)
    .doc(mappingId(connectionId, categoryId))
    .get();
  if (!snapshot.exists) return null;
  const value = snapshot.data() as StoredCategoryMapping;
  return value.is_deleted ? null : categoryMappingDto(value);
};

export const savePartnerCategoryMapping = async (input: {
  connectionId: string;
  categoryId: string;
  partnerTypeId: string;
  partnerTypeName: string;
  actorId: string;
}): Promise<{
  before: PartnerCategoryMappingDto | null;
  after: PartnerCategoryMappingDto;
}> => {
  const id = mappingId(input.connectionId, input.categoryId);
  const reference = db.collection(CATEGORY_MAPPINGS).doc(id);
  const now = new Date();
  const snapshot = await reference.get();
  const existing = snapshot.exists
    ? (snapshot.data() as StoredCategoryMapping)
    : null;
  const after: StoredCategoryMapping = {
    id,
    connection_id: input.connectionId,
    category_id: input.categoryId,
    partner_type_id: input.partnerTypeId,
    partner_type_name: input.partnerTypeName,
    version: existing ? existing.version + 1 : 1,
    is_deleted: false,
    created_at: existing?.created_at ?? now,
    updated_at: now,
    updated_by: input.actorId,
  };
  await reference.set(after);
  return {
    before: existing && !existing.is_deleted ? categoryMappingDto(existing) : null,
    after: categoryMappingDto(after),
  };
};

export const createPartnerInventorySnapshot = async (input: {
  snapshot: Omit<PartnerInventoryComparisonSnapshot, "id">;
  actorId: string;
}): Promise<PartnerInventoryComparisonSnapshot> => {
  const id = randomUUID();
  const stored: StoredSnapshot = {
    ...input.snapshot,
    id,
    fetched_at: new Date(input.snapshot.fetched_at),
    expires_at: new Date(input.snapshot.expires_at),
    created_by: input.actorId,
    is_deleted: false,
  };
  await db.collection(SNAPSHOTS).doc(id).set(stored);
  return snapshotDto(stored);
};

export const findPartnerInventorySnapshot = async (
  snapshotId: string,
): Promise<PartnerInventoryComparisonSnapshot | null> => {
  const snapshot = await db.collection(SNAPSHOTS).doc(snapshotId).get();
  if (!snapshot.exists) return null;
  const value = snapshot.data() as StoredSnapshot;
  return value.is_deleted ? null : snapshotDto(value);
};

export const findPartnerInventoryJob = async (
  requestId: string,
): Promise<(PartnerInventorySyncJobDto & { payload_fingerprint: string }) | null> => {
  const snapshot = await db.collection(JOBS).doc(requestId).get();
  if (!snapshot.exists) return null;
  const value = snapshot.data() as StoredJob;
  if (value.is_deleted) return null;
  return { ...jobDto(value), payload_fingerprint: value.payload_fingerprint };
};

export const createPartnerInventoryJob = async (input: {
  job: Omit<PartnerInventorySyncJobDto, "id">;
  payloadFingerprint: string;
}): Promise<PartnerInventorySyncJobDto> => {
  const reference = db.collection(JOBS).doc(input.job.request_id);
  const stored: StoredJob = {
    ...input.job,
    id: input.job.request_id,
    action_time: new Date(input.job.action_time),
    sync_time: new Date(input.job.sync_time),
    completed_at: input.job.completed_at
      ? new Date(input.job.completed_at)
      : null,
    payload_fingerprint: input.payloadFingerprint,
    is_deleted: false,
    updated_at: new Date(),
  };
  await reference.create(stored);
  return jobDto(stored);
};

export const updatePartnerInventoryJob = async (
  requestId: string,
  update: Pick<PartnerInventorySyncJobDto, "status" | "items" | "completed_at">,
): Promise<PartnerInventorySyncJobDto> => {
  const reference = db.collection(JOBS).doc(requestId);
  await reference.update({
    status: update.status,
    items: update.items,
    completed_at: update.completed_at ? new Date(update.completed_at) : null,
    updated_at: new Date(),
  });
  const snapshot = await reference.get();
  return jobDto(snapshot.data() as StoredJob);
};
