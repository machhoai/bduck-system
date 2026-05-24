import { BaseRepository } from "./baseRepository.js";
import type { ProductBOM } from "@bduck/shared-types";
import { db } from "../config/firebase.js";

class ProductBomRepository extends BaseRepository<ProductBOM> {
  constructor() {
    super("product_bom");
  }

  /**
   * Lấy tất cả BOM items thuộc về 1 parent_product_id.
   * Do collection product_bom chứa toàn bộ quan hệ, ta query theo `parent_product_id`.
   */
  async getBomByParentId(parentProductId: string): Promise<ProductBOM[]> {
    const snapshot = await db
      .collection(this.collectionName)
      .where("parent_product_id", "==", parentProductId)
      .where("is_deleted", "==", false)
      .get();

    return snapshot.docs.map(
      (doc) => ({ ...doc.data(), id: doc.id }) as ProductBOM,
    );
  }

  /**
   * Truy cập trực tiếp db instance để dùng trong Transaction
   */
  getDbInstance() {
    return db;
  }
}

export const productBomRepository = new ProductBomRepository();
