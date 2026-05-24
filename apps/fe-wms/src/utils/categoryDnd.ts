import type { ProductCategory } from "@bduck/shared-types";
import {
  buildCategoryTree,
  findCategoryNode,
  getCategoryDepthMap,
  getSubtreeHeight,
  isDescendantCategory,
  MAX_CATEGORY_DEPTH,
} from "./categoryTree";

export type CategoryDropPosition = "into" | "above" | "below" | "root";

export type CategoryDropRejectReason =
  | "MAX_DEPTH"
  | "SELF"
  | "DESCENDANT"
  | "MISSING_NODE";

export interface CategoryDropIntent {
  draggedId: string;
  targetId: string | null;
  position: CategoryDropPosition;
  nextParentId: string | null;
}

export interface CategoryDropValidation {
  valid: boolean;
  reason?: CategoryDropRejectReason;
  nextDeepestDepth?: number;
}

interface ResolveDropIntentInput {
  draggedId: string;
  overId: string | null;
  categories: ProductCategory[];
}

export function getCategoryDropZoneId(
  categoryId: string,
  position: Exclude<CategoryDropPosition, "root">,
) {
  return `category:${categoryId}:${position}`;
}

export function getRootDropZoneId() {
  return "category:root";
}

export function parseCategoryDropZoneId(overId: string | null): {
  targetId: string | null;
  position: CategoryDropPosition;
} | null {
  if (!overId) return null;
  if (overId === getRootDropZoneId()) {
    return { targetId: null, position: "root" };
  }

  const match = overId.match(/^category:(.+):(into|above|below)$/);
  if (!match) return null;

  return {
    targetId: match[1],
    position: match[2] as CategoryDropPosition,
  };
}

export function resolveCategoryDropIntent({
  draggedId,
  overId,
  categories,
}: ResolveDropIntentInput): CategoryDropIntent | null {
  const parsedDropZone = parseCategoryDropZoneId(overId);
  if (!parsedDropZone) return null;

  const { targetId, position } = parsedDropZone;
  if (position === "root") {
    return {
      draggedId,
      targetId: null,
      position,
      nextParentId: null,
    };
  }

  const targetCategory = categories.find(
    (category) => category.id === targetId,
  );
  if (!targetCategory || !targetId) return null;

  return {
    draggedId,
    targetId,
    position,
    nextParentId:
      position === "into"
        ? targetCategory.id
        : targetCategory.parent_id || null,
  };
}

export function validateCategoryDrop(
  categories: ProductCategory[],
  intent: CategoryDropIntent,
): CategoryDropValidation {
  const tree = buildCategoryTree(categories);
  const draggedNode = findCategoryNode(tree, intent.draggedId);

  if (!draggedNode) {
    return { valid: false, reason: "MISSING_NODE" };
  }

  if (intent.targetId === intent.draggedId) {
    return { valid: false, reason: "SELF" };
  }

  if (
    intent.nextParentId &&
    isDescendantCategory(tree, intent.draggedId, intent.nextParentId)
  ) {
    return { valid: false, reason: "DESCENDANT" };
  }

  const depthMap = getCategoryDepthMap(tree);
  const targetParentDepth = intent.nextParentId
    ? depthMap.get(intent.nextParentId)
    : 0;

  if (targetParentDepth === undefined) {
    return { valid: false, reason: "MISSING_NODE" };
  }

  const nextDeepestDepth = targetParentDepth + getSubtreeHeight(draggedNode);
  if (nextDeepestDepth > MAX_CATEGORY_DEPTH) {
    return {
      valid: false,
      reason: "MAX_DEPTH",
      nextDeepestDepth,
    };
  }

  return { valid: true, nextDeepestDepth };
}

export function applyOptimisticCategoryMove(
  categories: ProductCategory[],
  intent: CategoryDropIntent,
): ProductCategory[] {
  const draggedCategory = categories.find(
    (category) => category.id === intent.draggedId,
  );
  if (!draggedCategory) return categories;

  const nextCategories = categories.filter(
    (category) => category.id !== intent.draggedId,
  );

  const movedCategory: ProductCategory = {
    ...draggedCategory,
    parent_id: intent.nextParentId,
  };

  if (intent.position === "root") {
    return [movedCategory, ...nextCategories];
  }

  const targetIndex = nextCategories.findIndex(
    (category) => category.id === intent.targetId,
  );

  if (targetIndex < 0 || intent.position === "into") {
    return [...nextCategories, movedCategory];
  }

  const insertionIndex =
    intent.position === "above" ? targetIndex : targetIndex + 1;

  return [
    ...nextCategories.slice(0, insertionIndex),
    movedCategory,
    ...nextCategories.slice(insertionIndex),
  ];
}

export function didParentChange(
  categories: ProductCategory[],
  intent: CategoryDropIntent,
) {
  const draggedCategory = categories.find(
    (category) => category.id === intent.draggedId,
  );

  return Boolean(
    draggedCategory && draggedCategory.parent_id !== intent.nextParentId,
  );
}
