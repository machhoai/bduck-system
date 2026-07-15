import { db } from "../config/firebase.js";
import { BaseRepository } from "./baseRepository.js";
import type { WarehouseLocation } from "@bduck/shared-types";
import { executeFacilityScopedQuery } from "./facilityScopedQuery.js";

const COLLECTION = "warehouse_locations";
const INVENTORY_COLLECTION = "inventory";
const IN_QUERY_LIMIT = 30;

const hasPositiveQuantity = (data: FirebaseFirestore.DocumentData): boolean => {
  const quantityFields = [
    "total_quantity",
    "atp_quantity",
    "on_hold_quantity",
    "in_transit_quantity",
    "quarantine_quantity",
  ];

  return quantityFields.some((field) => Number(data[field] ?? 0) > 0);
};

class LocationRepository extends BaseRepository<WarehouseLocation> {
  constructor() {
    super(COLLECTION);
  }

  async findByWarehouseId(warehouseId: string): Promise<WarehouseLocation[]> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("warehouse_id", "==", warehouseId)
      .where("is_deleted", "==", false)
      .get();

    return snapshot.docs.map(
      (doc) => ({ ...doc.data(), id: doc.id }) as WarehouseLocation,
    );
  }

  async findScoped(scope: {
    isSystemAdmin: boolean;
    facilityIds: readonly string[];
  }): Promise<WarehouseLocation[]> {
    const groups = await executeFacilityScopedQuery({
      ...scope,
      queryAll: async () => {
        const snapshot = await db
          .collection(COLLECTION)
          .where("is_deleted", "==", false)
          .get();
        return snapshot.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id }) as WarehouseLocation,
        );
      },
      queryChunk: async (facilityIds) => {
        const snapshot = await db
          .collection(COLLECTION)
          .where("is_deleted", "==", false)
          .where("warehouse_id", "in", facilityIds)
          .get();
        return snapshot.docs.map(
          (doc) => ({ ...doc.data(), id: doc.id }) as WarehouseLocation,
        );
      },
    });
    return groups.flat();
  }

  async findByWarehouseAndCode(
    warehouseId: string,
    code: string,
  ): Promise<WarehouseLocation | null> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("warehouse_id", "==", warehouseId)
      .where("code", "==", code)
      .where("is_deleted", "==", false)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return {
      ...snapshot.docs[0].data(),
      id: snapshot.docs[0].id,
    } as WarehouseLocation;
  }

  async hasActiveLocations(warehouseId: string): Promise<boolean> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("warehouse_id", "==", warehouseId)
      .where("status", "==", "ACTIVE")
      .where("is_deleted", "==", false)
      .limit(1)
      .get();

    return !snapshot.empty;
  }

  async hasPositiveInventory(locationId: string): Promise<boolean> {
    const snapshot = await db
      .collection(INVENTORY_COLLECTION)
      .where("warehouse_location_id", "==", locationId)
      .get();

    return snapshot.docs.some((doc) => hasPositiveQuantity(doc.data()));
  }

  async hasPositiveInventoryInWarehouse(warehouseId: string): Promise<boolean> {
    const locations = await this.findByWarehouseId(warehouseId);
    const locationIds = locations.map((location) => location.id);

    for (let index = 0; index < locationIds.length; index += IN_QUERY_LIMIT) {
      const chunk = locationIds.slice(index, index + IN_QUERY_LIMIT);
      if (chunk.length === 0) continue;

      const snapshot = await db
        .collection(INVENTORY_COLLECTION)
        .where("warehouse_location_id", "in", chunk)
        .get();

      if (snapshot.docs.some((doc) => hasPositiveQuantity(doc.data()))) {
        return true;
      }
    }

    return false;
  }
}

export const locationRepository = new LocationRepository();
