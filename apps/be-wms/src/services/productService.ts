import { productRepository } from "../repositories/productRepository.js";
import { categoryRepository } from "../repositories/categoryRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import { createProductSchema } from "../utils/zodSchemas.js";
import { AuditAction } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { Product } from "@bduck/shared-types";
import type { z } from "zod";

type CreateProductInput = z.infer<typeof createProductSchema>;
type UpdateProductInput = Partial<
  Omit<CreateProductInput, "code" | "is_serialized">
>;

export const createProduct = async (
  input: CreateProductInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<Product> => {
  // 1. Validate category_id exists
  const categoryExists = await categoryRepository.findById(input.category_id);
  if (!categoryExists || categoryExists.is_deleted) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Danh mục sản phẩm không tồn tại hoặc đã bị xóa.",
        zh: "产品类别不存在或已被删除。",
      },
    };
  }

  // 2. Check unique code
  const codeExists = await productRepository.findByCode(input.code);
  if (codeExists) {
    throw {
      statusCode: 409,
      messages: {
        vi: `Mã sản phẩm "${input.code}" đã tồn tại.`,
        zh: `产品代码 "${input.code}" 已存在。`,
      },
    };
  }

  // 3. Check unique barcode if provided
  if (input.barcode) {
    const barcodeExists = await productRepository.findByBarcode(input.barcode);
    if (barcodeExists) {
      throw {
        statusCode: 409,
        messages: {
          vi: `Mã vạch (Barcode) "${input.barcode}" đã tồn tại.`,
          zh: `条形码 "${input.barcode}" 已存在。`,
        },
      };
    }
  }

  // 4. Create
  const id = randomUUID();
  const product = await productRepository.create(id, {
    id,
    category_id: input.category_id,
    name: input.name,
    code: input.code,
    barcode: input.barcode || null,
    product_image_url: input.product_image_url || null,
    product_material: input.product_material || null,
    product_origin: input.product_origin || null,
    unit: input.unit,
    product_type: input.product_type,
    unit_price: input.unit_price ?? null,
    is_serialized: input.is_serialized,
    description: input.description || null,
  } as any);

  // 5. Audit log
  await logAudit({
    entity_type: "products",
    entity_id: id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: product as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return product;
};

export const fetchProducts = async (
  page: number = 1,
  limit: number = 20,
  categoryId?: string,
) => {
  return productRepository.findProducts({ page, limit, categoryId });
};

export const fetchProductById = async (id: string): Promise<Product> => {
  const product = await productRepository.findById(id);
  if (!product || product.is_deleted) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Sản phẩm không tồn tại.",
        zh: "产品不存在。",
      },
    };
  }
  return product;
};

export const updateProduct = async (
  id: string,
  input: UpdateProductInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await fetchProductById(id);

  // 1. Validate category_id if changed
  if (input.category_id && input.category_id !== existing.category_id) {
    const categoryExists = await categoryRepository.findById(input.category_id);
    if (!categoryExists || categoryExists.is_deleted) {
      throw {
        statusCode: 404,
        messages: {
          vi: "Danh mục sản phẩm không tồn tại hoặc đã bị xóa.",
          zh: "产品类别不存在或已被删除。",
        },
      };
    }
  }

  // 2. Check unique barcode if changed
  if (input.barcode && input.barcode !== existing.barcode) {
    const barcodeExists = await productRepository.findByBarcode(input.barcode);
    if (barcodeExists) {
      throw {
        statusCode: 409,
        messages: {
          vi: `Mã vạch (Barcode) "${input.barcode}" đã tồn tại.`,
          zh: `条形码 "${input.barcode}" 已存在。`,
        },
      };
    }
  }

  // 3. Update (code and is_serialized are omitted from input interface)
  await productRepository.update(id, input as any);

  // 4. Audit Log
  await logAudit({
    entity_type: "products",
    entity_id: id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: input as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
};

export const deleteProduct = async (
  id: string,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await fetchProductById(id);

  // TODO: Phase 2 - Check Inventory Records
  // We cannot delete a product if it has existing inventory > 0.
  // This requires querying the 'inventory' collection which will be implemented in Phase 2.
  // For now, we will allow soft delete assuming no inventory exists.
  /*
  const hasInventory = await inventoryRepository.hasStock(id);
  if (hasInventory) {
    throw {
      statusCode: 400,
      messages: {
        vi: 'Không thể xóa sản phẩm đang còn tồn kho.',
        zh: '无法删除有库存的产品。',
      }
    };
  }
  */

  await productRepository.softDelete(id);

  await logAudit({
    entity_type: "products",
    entity_id: id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true },
    ...auditMetadata,
  });
};
