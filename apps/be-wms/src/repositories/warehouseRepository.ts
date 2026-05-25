import { db } from "../config/firebase.js";
import { BaseRepository } from "./baseRepository.js";
import type { Warehouse } from "@bduck/shared-types";

const COLLECTION = "warehouses";

const getSortableTime = (value: unknown): number => {
  if (value instanceof Date) return value.getTime();

  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }

  if (
    value &&
    typeof value === "object" &&
    "seconds" in value &&
    typeof (value as { seconds: unknown }).seconds === "number"
  ) {
    return (value as { seconds: number }).seconds * 1000;
  }

  return 0;
};

class WarehouseRepository extends BaseRepository<Warehouse> {
  constructor() {
    super(COLLECTION);
  }

  async findByCode(code: string): Promise<Warehouse | null> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("code", "==", code)
      .where("is_deleted", "==", false)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return { ...snapshot.docs[0].data(), id: snapshot.docs[0].id } as Warehouse;
  }

  async hasActiveByOrganizationId(organizationId: string): Promise<boolean> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("organization_id", "==", organizationId)
      .where("is_deleted", "==", false)
      .limit(1)
      .get();

    return !snapshot.empty;
  }

  async findWarehouses(params?: {
    accessibleWarehouseIds?: string[];
  }): Promise<Warehouse[]> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("is_deleted", "==", false)
      .get();

    const accessibleIds = params?.accessibleWarehouseIds
      ? new Set(params.accessibleWarehouseIds)
      : null;

    return snapshot.docs
      .map((doc) => ({ ...doc.data(), id: doc.id }) as Warehouse)
      .filter((warehouse) =>
        accessibleIds ? accessibleIds.has(warehouse.id) : true,
      )
      .sort(
        (a, b) =>
          getSortableTime(
            (b as unknown as { created_at?: unknown }).created_at,
          ) -
          getSortableTime(
            (a as unknown as { created_at?: unknown }).created_at,
          ),
      );
  }
}

export const warehouseRepository = new WarehouseRepository();
