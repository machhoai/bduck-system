"use client";

import { useState } from "react";
import {
  ChevronRight,
  ChevronDown,
  Pencil,
  Trash2,
  FolderOpen,
  Folder,
} from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import type { ProductCategory } from "@bduck/shared-types";

interface CategoryTreeProps {
  categories: ProductCategory[];
  onEdit: (category: ProductCategory) => void;
  onDelete: (category: ProductCategory) => void;
  hasPermission: (action: string) => boolean;
}

interface TreeNode extends ProductCategory {
  children: TreeNode[];
}

/**
 * Build tree structure from flat list
 */
function buildTree(categories: ProductCategory[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  // First pass: create nodes
  categories.forEach((cat) => {
    map.set(cat.id, { ...cat, children: [] });
  });

  // Second pass: link children
  categories.forEach((cat) => {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      map.get(cat.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

/**
 * Desktop: Tree view component with expand/collapse
 */
export default function CategoryTree({
  categories,
  onEdit,
  onDelete,
  hasPermission,
}: CategoryTreeProps) {
  const tree = buildTree(categories);

  return (
    <div className="hidden md:block">
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        {tree.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y divide-gray-50">
            {tree.map((node) => (
              <TreeItem
                key={node.id}
                node={node}
                depth={0}
                onEdit={onEdit}
                onDelete={onDelete}
                hasPermission={hasPermission}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TreeItem({
  node,
  depth,
  onEdit,
  onDelete,
  hasPermission,
}: {
  node: TreeNode;
  depth: number;
  onEdit: (cat: ProductCategory) => void;
  onDelete: (cat: ProductCategory) => void;
  hasPermission: (action: string) => boolean;
}) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50"
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        {/* Expand toggle */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={`shrink-0 rounded-md p-0.5 text-gray-400 transition-colors
            ${hasChildren ? "hover:bg-gray-200 hover:text-gray-600" : "invisible"}`}
          disabled={!hasChildren}
        >
          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </button>

        {/* Icon */}
        {hasChildren || depth === 0 ? (
          <FolderOpen size={18} className="shrink-0 text-amber-500" />
        ) : (
          <Folder size={18} className="shrink-0 text-gray-400" />
        )}

        {/* Name + Code */}
        <div className="min-w-0 flex-1">
          <span className="text-sm font-medium text-gray-900">{node.name}</span>
          <span className="ml-2 text-xs text-gray-400">{node.code}</span>
        </div>

        {/* Type badge */}
        <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">
          {t.categories.types[node.type as keyof typeof t.categories.types]}
        </span>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {hasPermission("category.update") && (
            <button
              onClick={() => onEdit(node)}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
              title={t.common.edit}
            >
              <Pencil size={15} />
            </button>
          )}
          {hasPermission("category.delete") && (
            <button
              onClick={() => onDelete(node)}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              title={t.common.delete}
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              onEdit={onEdit}
              onDelete={onDelete}
              hasPermission={hasPermission}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FolderOpen size={48} className="mb-4 text-gray-300" />
      <p className="text-sm text-gray-400">{t.categories.empty}</p>
    </div>
  );
}
