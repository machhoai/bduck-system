import { db } from '../config/firebase.js';
import { BaseRepository } from './baseRepository.js';
import type { ProductCategory } from '@bduck/shared-types';

const COLLECTION = 'product_categories';

class CategoryRepository extends BaseRepository<ProductCategory> {
  constructor() {
    super(COLLECTION);
  }

  /**
   * Check if a category code already exists (excluding soft-deleted)
   */
  async findByCode(code: string): Promise<ProductCategory | null> {
    const snapshot = await db
      .collection(COLLECTION)
      .where('code', '==', code)
      .where('is_deleted', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) return null;
    return snapshot.docs[0].data() as ProductCategory;
  }

  /**
   * Get all children of a parent category (direct children only)
   */
  async findByParentId(parentId: string | null): Promise<ProductCategory[]> {
    const snapshot = await db
      .collection(COLLECTION)
      .where('parent_id', '==', parentId)
      .where('is_deleted', '==', false)
      .get();

    return snapshot.docs.map(doc => doc.data() as ProductCategory);
  }

  /**
   * Recursively check if a category has any active children
   * Used to prevent deletion of parent categories with children
   */
  async hasActiveChildren(categoryId: string): Promise<boolean> {
    const children = await this.findByParentId(categoryId);
    return children.length > 0;
  }

  /**
   * Get the depth of a category in the tree
   * Root = 0, Child = 1, Grandchild = 2
   */
  async getDepth(parentId: string | null): Promise<number> {
    if (!parentId) return 0;

    let depth = 0;
    let currentParentId: string | null = parentId;

    while (currentParentId) {
      depth++;
      const parent = await this.findById(currentParentId);
      if (!parent || parent.is_deleted) break;
      currentParentId = parent.parent_id;
    }

    return depth;
  }
}

export const categoryRepository = new CategoryRepository();
