import { db } from "../config/firebase.js";
import { calculateInventoryTotalQuantity } from "@bduck/shared-types";
import type { Inventory } from "@bduck/shared-types";
import { executeFacilityScopedQuery } from "./facilityScopedQuery.js";

/**
 * Inventory Repository
 *
 * Manages the `inventory` collection in Firestore.
 * Each document represents a UNIQUE(warehouse_location_id, product_id) pair.
 * warehouse_id is denormalized for direct queries.
 *
 * NOTE: Inventory records are soft-deleted to preserve audit evidence.
 * Deleted records are zeroed out and excluded from normal reads.
 */

const COLLECTION = "inventory";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const findById = async (id: string): Promise<Inventory | null> => {
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  const record = doc.data() as Inventory;
  return record.is_deleted ? null : record;
};

export const findByLocationAndProduct = async (
  warehouseLocationId: string,
  productId: string,
): Promise<Inventory | null> => {
  const snapshot = await db
    .collection(COLLECTION)
    .where("warehouse_location_id", "==", warehouseLocationId)
    .where("product_id", "==", productId)
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const record = snapshot.docs[0].data() as Inventory;
  return record.is_deleted ? null : record;
};

export const findByWarehouse = async (
  warehouseId: string,
): Promise<Inventory[]> => {
  const snapshot = await db
    .collection(COLLECTION)
    .where("warehouse_id", "==", warehouseId)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as Inventory)
    .filter((record) => record.is_deleted !== true);
};

export const findByProduct = async (
  productId: string,
): Promise<Inventory[]> => {
  const snapshot = await db
    .collection(COLLECTION)
    .where("product_id", "==", productId)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as Inventory)
    .filter((record) => record.is_deleted !== true);
};

export const findAll = async (filters?: {
  warehouse_id?: string;
  warehouse_location_id?: string;
  product_id?: string;
}): Promise<Inventory[]> => {
  let query: FirebaseFirestore.Query = db.collection(COLLECTION);

  if (filters?.warehouse_id) {
    query = query.where("warehouse_id", "==", filters.warehouse_id);
  }
  if (filters?.warehouse_location_id) {
    query = query.where(
      "warehouse_location_id",
      "==",
      filters.warehouse_location_id,
    );
  }
  if (filters?.product_id) {
    query = query.where("product_id", "==", filters.product_id);
  }

  const snapshot = await query.get();
  return snapshot.docs
    .map((doc) => doc.data() as Inventory)
    .filter((record) => record.is_deleted !== true);
};

export const findAllScoped = async (
  filters: {
    warehouse_location_id?: string;
    product_id?: string;
  },
  scope: { isSystemAdmin: boolean; facilityIds: readonly string[] },
): Promise<Inventory[]> => {
  const queryFacilities = async (facilityIds?: readonly string[]) => {
    let query: FirebaseFirestore.Query = db
      .collection(COLLECTION)
      .where("is_deleted", "==", false);
    if (facilityIds) query = query.where("warehouse_id", "in", facilityIds);
    if (filters.warehouse_location_id) {
      query = query.where(
        "warehouse_location_id",
        "==",
        filters.warehouse_location_id,
      );
    }
    if (filters.product_id) {
      query = query.where("product_id", "==", filters.product_id);
    }
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data() as Inventory);
  };
  const groups = await executeFacilityScopedQuery({
    ...scope,
    queryAll: () => queryFacilities(),
    queryChunk: queryFacilities,
  });
  return groups.flat();
};

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const create = async (
  id: string,
  data: Omit<Inventory, "last_updated_at">,
): Promise<Inventory> => {
  const now = new Date();
  const record: Inventory = {
    ...data,
    is_deleted: false,
    last_updated_at: now,
  };

  await db.collection(COLLECTION).doc(id).set(record);
  return record;
};

export const update = async (
  id: string,
  data: Partial<
    Pick<
      Inventory,
      | "atp_quantity"
      | "on_hold_quantity"
      | "in_transit_quantity"
      | "quarantine_quantity"
      | "total_quantity"
      | "last_count_at"
    >
  >,
): Promise<void> => {
  await db
    .collection(COLLECTION)
    .doc(id)
    .update({
      ...data,
      last_updated_at: new Date(),
    });
};

/**
 * Upsert: Find by (location, product), create if not exists, or increment quantities.
 * Used internally by import/transfer flows. Runs inside a transaction.
 */
export const upsertQuantityInTransaction = async (
  txn: FirebaseFirestore.Transaction,
  warehouseId: string,
  warehouseLocationId: string,
  productId: string,
  deltas: {
    atp_quantity?: number;
    on_hold_quantity?: number;
    in_transit_quantity?: number;
    quarantine_quantity?: number;
  },
  newId: string,
): Promise<void> => {
  const snapshot = await txn.get(
    db
      .collection(COLLECTION)
      .where("warehouse_location_id", "==", warehouseLocationId)
      .where("product_id", "==", productId)
      .limit(1),
  );

  const now = new Date();

  if (snapshot.empty) {
    // Create new record
    const atpQty = deltas.atp_quantity ?? 0;
    const onHoldQty = deltas.on_hold_quantity ?? 0;
    const inTransitQty = deltas.in_transit_quantity ?? 0;
    const quarantineQty = deltas.quarantine_quantity ?? 0;

    const record: Inventory = {
      id: newId,
      warehouse_id: warehouseId,
      warehouse_location_id: warehouseLocationId,
      product_id: productId,
      atp_quantity: atpQty,
      on_hold_quantity: onHoldQty,
      in_transit_quantity: inTransitQty,
      quarantine_quantity: quarantineQty,
      total_quantity: calculateInventoryTotalQuantity({
        atp_quantity: atpQty,
        on_hold_quantity: onHoldQty,
        in_transit_quantity: inTransitQty,
        quarantine_quantity: quarantineQty,
      }),
      last_count_at: null,
      last_updated_at: now,
      is_deleted: false,
    };

    txn.set(db.collection(COLLECTION).doc(newId), record);
  } else {
    // Update existing record — increment quantities
    const existing = snapshot.docs[0].data() as Inventory;
    const docRef = db.collection(COLLECTION).doc(existing.id);

    const newAtp = existing.atp_quantity + (deltas.atp_quantity ?? 0);
    const newOnHold =
      existing.on_hold_quantity + (deltas.on_hold_quantity ?? 0);
    const newInTransit =
      existing.in_transit_quantity + (deltas.in_transit_quantity ?? 0);
    const newQuarantine =
      existing.quarantine_quantity + (deltas.quarantine_quantity ?? 0);

    txn.update(docRef, {
      atp_quantity: newAtp,
      on_hold_quantity: newOnHold,
      in_transit_quantity: newInTransit,
      quarantine_quantity: newQuarantine,
      total_quantity: calculateInventoryTotalQuantity({
        atp_quantity: newAtp,
        on_hold_quantity: newOnHold,
        in_transit_quantity: newInTransit,
        quarantine_quantity: newQuarantine,
      }),
      last_updated_at: now,
    });
  }
};

export const softDelete = async (id: string): Promise<void> => {
  await db.collection(COLLECTION).doc(id).update({
    atp_quantity: 0,
    on_hold_quantity: 0,
    in_transit_quantity: 0,
    quarantine_quantity: 0,
    total_quantity: 0,
    is_deleted: true,
    last_updated_at: new Date(),
  });
};
