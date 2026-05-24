import { productBomRepository } from "../repositories/productBomRepository.js";
import { productRepository } from "../repositories/productRepository.js";
import { logAudit } from "./auditService.js";
import { v4 as uuidv4 } from "uuid";
import { AuditAction } from "@bduck/shared-types";
import type { ProductBOM } from "@bduck/shared-types";

export const fetchBomByProductId = async (
  productId: string,
): Promise<ProductBOM[]> => {
  // Ensure product exists
  const parentProduct = await productRepository.findById(productId);
  if (!parentProduct) {
    throw new Error("Không tìm thấy sản phẩm cha (Parent Product not found)");
  }
  return await productBomRepository.getBomByParentId(productId);
};

export const updateProductBom = async (
  parentProductId: string,
  bomItems: Array<{
    child_product_id: string;
    quantity: number;
    note?: string | null;
  }>,
  userId: string,
): Promise<void> => {
  const db = productBomRepository.getDbInstance();
  let existingBoms: ProductBOM[] = [];

  // 1. Kiểm tra tồn tại Parent Product
  const parentProduct = await productRepository.findById(parentProductId);
  if (!parentProduct) {
    throw new Error("Sản phẩm cha không tồn tại.");
  }

  // 2. Mở Firestore Transaction
  await db.runTransaction(async (transaction) => {
    // 2.1 Fetch existing BOMs for this parent
    const bomCollectionRef = db.collection("product_bom");
    const existingSnapshot = await transaction.get(
      bomCollectionRef.where("parent_product_id", "==", parentProductId),
    );

    existingBoms = existingSnapshot.docs.map(
      (doc) => ({ ...doc.data(), id: doc.id }) as ProductBOM,
    );

    // Tạo map để dễ lookup
    const existingMap = new Map<string, ProductBOM>();
    existingBoms.forEach((bom) => {
      // Chỉ quan tâm những BOM đang active (chưa bị xóa)
      if (!bom.is_deleted) {
        existingMap.set(bom.child_product_id, bom);
      }
    });

    const newMap = new Map<string, any>();
    bomItems.forEach((item) => {
      newMap.set(item.child_product_id, item);
    });

    const now = new Date();

    // 2.2 Xử lý Deletes (Có trong existing, không có trong new)
    for (const [childId, existingBom] of existingMap.entries()) {
      if (!newMap.has(childId)) {
        // Soft delete
        const ref = bomCollectionRef.doc(existingBom.id);
        transaction.update(ref, {
          is_deleted: true,
          updated_at: now,
        });
      }
    }

    // 2.3 Xử lý Updates & Creates
    for (const [childId, newItem] of newMap.entries()) {
      // Check if child product actually exists
      // Vì transaction.get() trên một document riêng lẻ rất nhanh, ta có thể check (tùy chọn)
      const childDocRef = db.collection("products").doc(childId);
      const childDoc = await transaction.get(childDocRef);
      if (!childDoc.exists || childDoc.data()?.is_deleted) {
        throw new Error(
          `Phụ tùng với ID ${childId} không tồn tại hoặc đã bị xóa.`,
        );
      }

      if (existingMap.has(childId)) {
        // Update
        const existingBom = existingMap.get(childId)!;
        // Chỉ update nếu có sự thay đổi về quantity hoặc note
        if (
          existingBom.quantity !== newItem.quantity ||
          existingBom.note !== newItem.note
        ) {
          const ref = bomCollectionRef.doc(existingBom.id);
          transaction.update(ref, {
            quantity: newItem.quantity,
            note: newItem.note || null,
            updated_at: now,
          });
        }
      } else {
        // Create
        const newId = uuidv4();
        const ref = bomCollectionRef.doc(newId);
        const bomData: ProductBOM = {
          id: newId,
          parent_product_id: parentProductId,
          child_product_id: childId,
          quantity: newItem.quantity,
          note: newItem.note || null,
          is_deleted: false,
          created_at: now,
          updated_at: now,
        };
        transaction.set(ref, bomData);
      }
    }
  });

  // Ghi Audit Log cho hành động thay đổi định mức (BOM)
  // Thực hiện sau transaction để nhất quán với cách làm của productService
  await logAudit({
    entity_type: "product_bom",
    entity_id: parentProductId,
    action: "UPDATE" as AuditAction,
    user_id: userId,
    old_value: { items: existingBoms } as unknown as Record<string, unknown>,
    new_value: { items: bomItems } as unknown as Record<string, unknown>,
    notes: "Bulk updated BOM items",
  });
};
