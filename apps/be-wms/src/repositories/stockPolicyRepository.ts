import { StockPolicyScope } from "@bduck/shared-types";
import type { InventoryStockPolicy } from "@bduck/shared-types";
import { db } from "../config/firebase.js";
import { BaseRepository } from "./baseRepository.js";
import { executeFacilityScopedQuery } from "./facilityScopedQuery.js";

const COLLECTION = "inventory_stock_policies";

class StockPolicyRepository extends BaseRepository<InventoryStockPolicy> {
  constructor() {
    super(COLLECTION);
  }

  async findByFilters(filters: {
    warehouse_id?: string;
    warehouse_location_id?: string;
    warehouse_location_slot_id?: string;
    product_id?: string;
    scope?: StockPolicyScope;
  }): Promise<InventoryStockPolicy[]> {
    let query: FirebaseFirestore.Query = db
      .collection(COLLECTION)
      .where("is_deleted", "==", false);

    if (filters.warehouse_id) {
      query = query.where("warehouse_id", "==", filters.warehouse_id);
    }
    if (filters.warehouse_location_id) {
      query = query.where(
        "warehouse_location_id",
        "==",
        filters.warehouse_location_id,
      );
    }
    if (filters.warehouse_location_slot_id) {
      query = query.where(
        "warehouse_location_slot_id",
        "==",
        filters.warehouse_location_slot_id,
      );
    }
    if (filters.product_id) {
      query = query.where("product_id", "==", filters.product_id);
    }
    if (filters.scope) {
      query = query.where("scope", "==", filters.scope);
    }

    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data() as InventoryStockPolicy);
  }

  async findByFiltersScoped(
    filters: {
      warehouse_location_id?: string;
      warehouse_location_slot_id?: string;
      product_id?: string;
      scope?: StockPolicyScope;
    },
    access: { isSystemAdmin: boolean; facilityIds: readonly string[] },
  ): Promise<InventoryStockPolicy[]> {
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
      if (filters.warehouse_location_slot_id) {
        query = query.where(
          "warehouse_location_slot_id",
          "==",
          filters.warehouse_location_slot_id,
        );
      }
      if (filters.product_id) {
        query = query.where("product_id", "==", filters.product_id);
      }
      if (filters.scope) query = query.where("scope", "==", filters.scope);
      const snapshot = await query.get();
      return snapshot.docs.map((doc) => doc.data() as InventoryStockPolicy);
    };
    const groups = await executeFacilityScopedQuery({
      ...access,
      queryAll: () => queryFacilities(),
      queryChunk: queryFacilities,
    });
    return groups.flat();
  }

  async findExisting(filters: {
    scope: StockPolicyScope;
    warehouse_id: string;
    warehouse_location_id: string | null;
    warehouse_location_slot_id: string | null;
    product_id: string;
  }): Promise<InventoryStockPolicy | null> {
    let query: FirebaseFirestore.Query = db
      .collection(COLLECTION)
      .where("scope", "==", filters.scope)
      .where("warehouse_id", "==", filters.warehouse_id)
      .where("product_id", "==", filters.product_id)
      .where("is_deleted", "==", false);

    query =
      filters.warehouse_location_id === null
        ? query.where("warehouse_location_id", "==", null)
        : query.where(
            "warehouse_location_id",
            "==",
            filters.warehouse_location_id,
          );

    query =
      filters.warehouse_location_slot_id === null
        ? query.where("warehouse_location_slot_id", "==", null)
        : query.where(
            "warehouse_location_slot_id",
            "==",
            filters.warehouse_location_slot_id,
          );

    const snapshot = await query.limit(1).get();
    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as InventoryStockPolicy;
  }
}

export const stockPolicyRepository = new StockPolicyRepository();
