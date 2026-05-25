import { categoryRepository } from "../repositories/categoryRepository.js";
import { logAudit, type AuditMetadata } from "./auditService.js";
import { AuditAction } from "@bduck/shared-types";
import { randomUUID } from "crypto";
import type { ProductCategory } from "@bduck/shared-types";

const MAX_DEPTH = 3; // Tối đa 3 cấp: Cha → Con → Cháu

interface CreateCategoryInput {
  parent_id: string | null;
  name: string;
  code: string;
  type: string;
  category_description: string | null;
}

interface UpdateCategoryInput {
  name?: string;
  category_description?: string | null;
  parent_id?: string | null;
}

/**
 * Tạo danh mục mới
 */
export const createCategory = async (
  input: CreateCategoryInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<ProductCategory> => {
  // 1. Check unique code
  const existing = await categoryRepository.findByCode(input.code);
  if (existing) {
    throw {
      statusCode: 409,
      messages: {
        vi: `Mã danh mục "${input.code}" đã tồn tại.`,
        zh: `类别代码 "${input.code}" 已存在。`,
      },
    };
  }

  // 2. Check depth limit (max 3 levels)
  if (input.parent_id) {
    const parentExists = await categoryRepository.findById(input.parent_id);
    if (!parentExists || parentExists.is_deleted) {
      throw {
        statusCode: 404,
        messages: {
          vi: "Danh mục cha không tồn tại.",
          zh: "父类别不存在。",
        },
      };
    }

    const depth = await categoryRepository.getDepth(input.parent_id);
    if (depth + 1 >= MAX_DEPTH) {
      throw {
        statusCode: 400,
        messages: {
          vi: `Không thể tạo danh mục quá ${MAX_DEPTH} cấp.`,
          zh: `类别层级不能超过 ${MAX_DEPTH} 级。`,
        },
      };
    }
  }

  // 3. Create
  const id = randomUUID();
  const category = await categoryRepository.create(id, {
    id,
    parent_id: input.parent_id || null,
    name: input.name,
    code: input.code,
    type: input.type,
    category_description: input.category_description || null,
  } as any);

  // 4. Audit log
  await logAudit({
    entity_type: "product_categories",
    entity_id: id,
    action: AuditAction.CREATE,
    user_id: userId,
    old_value: null,
    new_value: category as unknown as Record<string, unknown>,
    ...auditMetadata,
  });

  return category;
};

/**
 * Lấy tất cả danh mục (active)
 */
export const fetchAllCategories = async (): Promise<ProductCategory[]> => {
  return categoryRepository.findAll(false);
};

/**
 * Lấy danh mục theo ID
 */
export const fetchCategoryById = async (
  id: string,
): Promise<ProductCategory> => {
  const category = await categoryRepository.findById(id);
  if (!category || category.is_deleted) {
    throw {
      statusCode: 404,
      messages: {
        vi: "Danh mục không tồn tại.",
        zh: "类别不存在。",
      },
    };
  }
  return category;
};

/**
 * Cập nhật danh mục
 */
export const updateCategory = async (
  id: string,
  input: UpdateCategoryInput,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await fetchCategoryById(id);

  // Check depth if changing parent
  if (input.parent_id !== undefined && input.parent_id !== existing.parent_id) {
    // Prevent moving to self
    if (input.parent_id === id) {
      throw {
        statusCode: 400,
        messages: {
          vi: "Không thể đặt danh mục là cha của chính nó.",
          zh: "不能将类别设为自身的父类别。",
        },
      };
    }

    if (input.parent_id) {
      const depth = await categoryRepository.getDepth(input.parent_id);
      if (depth + 1 >= MAX_DEPTH) {
        throw {
          statusCode: 400,
          messages: {
            vi: `Không thể di chuyển danh mục quá ${MAX_DEPTH} cấp.`,
            zh: `类别层级不能超过 ${MAX_DEPTH} 级。`,
          },
        };
      }
    }
  }

  await categoryRepository.update(id, input);

  await logAudit({
    entity_type: "product_categories",
    entity_id: id,
    action: AuditAction.UPDATE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: input as unknown as Record<string, unknown>,
    ...auditMetadata,
  });
};

/**
 * Soft delete danh mục
 * LUẬT: Không cho xóa nếu còn danh mục con ACTIVE
 */
export const deleteCategory = async (
  id: string,
  userId: string,
  auditMetadata?: AuditMetadata,
): Promise<void> => {
  const existing = await fetchCategoryById(id);

  const hasChildren = await categoryRepository.hasActiveChildren(id);
  if (hasChildren) {
    throw {
      statusCode: 400,
      messages: {
        vi: "Không thể xóa danh mục có chứa danh mục con. Hãy xóa danh mục con trước.",
        zh: "无法删除包含子类别的类别。请先删除子类别。",
      },
    };
  }

  await categoryRepository.softDelete(id);

  await logAudit({
    entity_type: "product_categories",
    entity_id: id,
    action: AuditAction.SOFT_DELETE,
    user_id: userId,
    old_value: existing as unknown as Record<string, unknown>,
    new_value: { is_deleted: true },
    ...auditMetadata,
  });
};
