import { db } from "../config/firebase.js";
import type { ExternalQueueScannableProductConfig } from "@bduck/shared-types";

const COLLECTION = "external_queue_scannable_products";

export async function findByLocationId(
  locationId: string,
): Promise<ExternalQueueScannableProductConfig | null> {
  const snap = await db.collection(COLLECTION).doc(locationId).get();
  if (!snap.exists) return null;

  const data = snap.data() as ExternalQueueScannableProductConfig;
  return data.is_deleted ? null : data;
}

export async function findByLocationIds(
  locationIds: string[],
): Promise<ExternalQueueScannableProductConfig[]> {
  const uniqueLocationIds = [...new Set(locationIds)].filter(Boolean);
  if (uniqueLocationIds.length === 0) return [];

  const docRefs = uniqueLocationIds.map((id) =>
    db.collection(COLLECTION).doc(id),
  );
  const snaps = await db.getAll(...docRefs);

  return snaps
    .filter((snap) => snap.exists)
    .map((snap) => snap.data() as ExternalQueueScannableProductConfig)
    .filter((config) => !config.is_deleted);
}

export async function upsertForLocation(params: {
  warehouseId: string;
  locationId: string;
  productIds: string[];
  updatedBy: string;
}): Promise<ExternalQueueScannableProductConfig> {
  const now = new Date();
  const ref = db.collection(COLLECTION).doc(params.locationId);
  const existing = await ref.get();
  const uniqueProductIds = [...new Set(params.productIds)].filter(Boolean);

  const config: ExternalQueueScannableProductConfig = {
    id: params.locationId,
    warehouse_id: params.warehouseId,
    warehouse_location_id: params.locationId,
    product_ids: uniqueProductIds,
    updated_by: params.updatedBy,
    is_deleted: false,
    created_at: existing.exists
      ? (existing.data() as ExternalQueueScannableProductConfig).created_at
      : now,
    updated_at: now,
  };

  await ref.set(config, { merge: true });
  return config;
}
