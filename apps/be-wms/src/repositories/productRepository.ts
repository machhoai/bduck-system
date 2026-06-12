import { db } from "../config/firebase.js";
import { BaseRepository } from "./baseRepository.js";
import type { Product } from "@bduck/shared-types";

const COLLECTION = "products";

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

class ProductRepository extends BaseRepository<Product> {
  constructor() {
    super(COLLECTION);
  }

  /**
   * Check if a product code (SKU) already exists (excluding soft-deleted)
   */
  async findByCode(code: string): Promise<Product | null> {
    const snapshot = await db
      .collection(COLLECTION)
      .where("code", "==", code)
      .where("is_deleted", "==", false)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as Product;
  }

  /**
   * Check if a barcode already exists (excluding soft-deleted)
   */
  async findByBarcode(barcode: string): Promise<Product | null> {
    if (!barcode) return null;

    const snapshot = await db
      .collection(COLLECTION)
      .where("barcode", "==", barcode)
      .where("is_deleted", "==", false)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as Product;
  }

  async findByIds(ids: string[]): Promise<Product[]> {
    const uniqueIds = [...new Set(ids)].filter(Boolean);
    if (uniqueIds.length === 0) return [];

    const docRefs = uniqueIds.map((id) => db.collection(COLLECTION).doc(id));
    const docSnaps = await db.getAll(...docRefs);

    return docSnaps
      .filter((doc) => doc.exists)
      .map((doc) => doc.data() as Product)
      .filter((product) => !product.is_deleted);
  }

  /**
   * Get products with pagination and optional search by code or category_id
   */
  async findProducts(params: {
    page: number;
    limit: number;
    categoryId?: string;
  }): Promise<{ data: Product[]; total: number }> {
    const { page, limit, categoryId } = params;
    const offset = (page - 1) * limit;

    const snapshot = await db.collection(COLLECTION).get();
    const products = snapshot.docs
      .map((doc) => ({ ...doc.data(), id: doc.id }) as Product)
      .filter((product) => !product.is_deleted)
      .filter((product) =>
        categoryId ? product.category_id === categoryId : true,
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

    return {
      data: products.slice(offset, offset + limit),
      total: products.length,
    };
  }
}

export const productRepository = new ProductRepository();
