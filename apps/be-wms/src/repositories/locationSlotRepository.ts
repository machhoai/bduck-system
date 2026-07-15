import { db } from "../config/firebase.js";
import { BaseRepository } from "./baseRepository.js";
import type {
  WarehouseLocationSlot,
  WarehouseLocationSlotProduct,
} from "@bduck/shared-types";
import { executeFacilityScopedQuery } from "./facilityScopedQuery.js";

const SLOT_COLLECTION = "warehouse_location_slots";
const SLOT_PRODUCT_COLLECTION = "warehouse_location_slot_products";

class LocationSlotRepository extends BaseRepository<WarehouseLocationSlot> {
  constructor() {
    super(SLOT_COLLECTION);
  }

  async findScoped(scope: {
    isSystemAdmin: boolean;
    facilityIds: readonly string[];
  }): Promise<WarehouseLocationSlot[]> {
    const groups = await executeFacilityScopedQuery({
      ...scope,
      queryAll: () => this.findAll(false),
      queryChunk: async (facilityIds) => {
        const snapshot = await db
          .collection(SLOT_COLLECTION)
          .where("warehouse_id", "in", facilityIds)
          .where("is_deleted", "==", false)
          .get();
        return snapshot.docs.map((doc) => doc.data() as WarehouseLocationSlot);
      },
    });
    return groups.flat().sort((a, b) => a.sort_order - b.sort_order);
  }

  async findByWarehouse(warehouseId: string): Promise<WarehouseLocationSlot[]> {
    const snapshot = await db
      .collection(SLOT_COLLECTION)
      .where("warehouse_id", "==", warehouseId)
      .where("is_deleted", "==", false)
      .get();

    return snapshot.docs
      .map((doc) => doc.data() as WarehouseLocationSlot)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  async findByLocation(locationId: string): Promise<WarehouseLocationSlot[]> {
    const snapshot = await db
      .collection(SLOT_COLLECTION)
      .where("warehouse_location_id", "==", locationId)
      .where("is_deleted", "==", false)
      .get();

    return snapshot.docs
      .map((doc) => doc.data() as WarehouseLocationSlot)
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  async findByLocationAndCode(
    locationId: string,
    code: string,
  ): Promise<WarehouseLocationSlot | null> {
    const snapshot = await db
      .collection(SLOT_COLLECTION)
      .where("warehouse_location_id", "==", locationId)
      .where("code", "==", code)
      .where("is_deleted", "==", false)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as WarehouseLocationSlot;
  }
}

class LocationSlotProductRepository extends BaseRepository<WarehouseLocationSlotProduct> {
  constructor() {
    super(SLOT_PRODUCT_COLLECTION);
  }

  async findScoped(scope: {
    isSystemAdmin: boolean;
    facilityIds: readonly string[];
  }): Promise<WarehouseLocationSlotProduct[]> {
    const groups = await executeFacilityScopedQuery({
      ...scope,
      queryAll: () => this.findAll(false),
      queryChunk: async (facilityIds) => {
        const snapshot = await db
          .collection(SLOT_PRODUCT_COLLECTION)
          .where("warehouse_id", "in", facilityIds)
          .where("is_deleted", "==", false)
          .get();
        return snapshot.docs.map(
          (doc) => doc.data() as WarehouseLocationSlotProduct,
        );
      },
    });
    return groups.flat();
  }

  async findByWarehouse(
    warehouseId: string,
  ): Promise<WarehouseLocationSlotProduct[]> {
    const snapshot = await db
      .collection(SLOT_PRODUCT_COLLECTION)
      .where("warehouse_id", "==", warehouseId)
      .where("is_deleted", "==", false)
      .get();

    return snapshot.docs.map(
      (doc) => doc.data() as WarehouseLocationSlotProduct,
    );
  }

  async findByLocation(
    locationId: string,
  ): Promise<WarehouseLocationSlotProduct[]> {
    const snapshot = await db
      .collection(SLOT_PRODUCT_COLLECTION)
      .where("warehouse_location_id", "==", locationId)
      .where("is_deleted", "==", false)
      .get();

    return snapshot.docs.map(
      (doc) => doc.data() as WarehouseLocationSlotProduct,
    );
  }

  async findByLocationAndProduct(
    locationId: string,
    productId: string,
  ): Promise<WarehouseLocationSlotProduct | null> {
    const snapshot = await db
      .collection(SLOT_PRODUCT_COLLECTION)
      .where("warehouse_location_id", "==", locationId)
      .where("product_id", "==", productId)
      .where("is_deleted", "==", false)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as WarehouseLocationSlotProduct;
  }
}

export const locationSlotRepository = new LocationSlotRepository();
export const locationSlotProductRepository =
  new LocationSlotProductRepository();
