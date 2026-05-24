import type { ProductCategory } from "@bduck/shared-types";

export const MAX_CATEGORY_DEPTH = 3;

export interface CategoryTreeNode extends ProductCategory {
  children: CategoryTreeNode[];
  depth: number;
}

export function buildCategoryTree(
  categories: ProductCategory[],
): CategoryTreeNode[] {
  const nodesById = new Map<string, CategoryTreeNode>();
  const roots: CategoryTreeNode[] = [];

  categories.forEach((category) => {
    nodesById.set(category.id, {
      ...category,
      children: [],
      depth: 1,
    });
  });

  categories.forEach((category) => {
    const node = nodesById.get(category.id);
    if (!node) return;

    const parent = category.parent_id
      ? nodesById.get(category.parent_id)
      : null;

    if (parent) {
      parent.children.push(node);
      return;
    }

    roots.push(node);
  });

  assignDepths(roots, 1);
  return roots;
}

export function flattenCategoryTree(
  tree: CategoryTreeNode[],
): CategoryTreeNode[] {
  return tree.flatMap((node) => [node, ...flattenCategoryTree(node.children)]);
}

export function findCategoryNode(
  tree: CategoryTreeNode[],
  id: string,
): CategoryTreeNode | null {
  for (const node of tree) {
    if (node.id === id) return node;

    const child = findCategoryNode(node.children, id);
    if (child) return child;
  }

  return null;
}

export function getSubtreeHeight(node: CategoryTreeNode): number {
  if (node.children.length === 0) return 1;

  return 1 + Math.max(...node.children.map(getSubtreeHeight));
}

export function isDescendantCategory(
  tree: CategoryTreeNode[],
  ancestorId: string,
  childId: string,
): boolean {
  const ancestor = findCategoryNode(tree, ancestorId);
  if (!ancestor) return false;

  return Boolean(findCategoryNode(ancestor.children, childId));
}

export function getCategoryDepthMap(
  tree: CategoryTreeNode[],
): Map<string, number> {
  const depthMap = new Map<string, number>();

  flattenCategoryTree(tree).forEach((node) => {
    depthMap.set(node.id, node.depth);
  });

  return depthMap;
}

export function filterCategoriesForTree(
  categories: ProductCategory[],
  query: string,
): ProductCategory[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return categories;

  const categoriesById = new Map(
    categories.map((category) => [category.id, category]),
  );
  const includedIds = new Set<string>();

  const includeAncestors = (category: ProductCategory) => {
    if (!category.parent_id) return;

    const parent = categoriesById.get(category.parent_id);
    if (!parent || includedIds.has(parent.id)) return;

    includedIds.add(parent.id);
    includeAncestors(parent);
  };

  const includeDescendants = (categoryId: string) => {
    categories.forEach((candidate) => {
      if (candidate.parent_id !== categoryId || includedIds.has(candidate.id)) {
        return;
      }

      includedIds.add(candidate.id);
      includeDescendants(candidate.id);
    });
  };

  categories.forEach((category) => {
    const isMatch =
      category.name.toLowerCase().includes(normalizedQuery) ||
      category.code.toLowerCase().includes(normalizedQuery);

    if (!isMatch) return;

    includedIds.add(category.id);
    includeAncestors(category);
    includeDescendants(category.id);
  });

  return categories.filter((category) => includedIds.has(category.id));
}

function assignDepths(nodes: CategoryTreeNode[], depth: number) {
  nodes.forEach((node) => {
    node.depth = depth;
    assignDepths(node.children, depth + 1);
  });
}
