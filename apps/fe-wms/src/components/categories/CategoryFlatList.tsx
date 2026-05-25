"use client";

import { Pencil, Trash2, FolderOpen, ChevronRight } from "lucide-react";
import { useTranslation } from "../../lib/i18n";
import type { ProductCategory } from "@bduck/shared-types";

interface CategoryFlatListProps {
  categories: ProductCategory[];
  onEdit: (category: ProductCategory) => void;
  onDelete: (category: ProductCategory) => void;
  hasPermission: (action: string) => boolean;
}

/**
 * Mobile: Flat list with parent name shown inline
 * Cảm giác native app — swipe-friendly, compact cards
 */
export default function CategoryFlatList({
  categories,
  onEdit,
  onDelete,
  hasPermission,
}: CategoryFlatListProps) {
  const { t } = useTranslation();

  // Build a lookup map for parent names
  const nameMap = new Map(categories.map((c) => [c.id, c.name]));

  if (categories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center md:hidden">
        <FolderOpen size={48} className="mb-4 text-gray-300" />
        <p className="text-sm text-gray-400">{t.categories.empty}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2 md:hidden">
      {categories.map((cat) => (
        <div
          key={cat.id}
          className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3.5 shadow-sm
            active:scale-[0.98] transition-transform"
        >
          {/* Left: Icon + Info */}
          <FolderOpen size={20} className="shrink-0 text-amber-500" />

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900 truncate">
                {cat.name}
              </span>
              <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-600">
                {
                  t.categories.types[
                    cat.type as keyof typeof t.categories.types
                  ]
                }
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
              <span>{cat.code}</span>
              {cat.parent_id && nameMap.has(cat.parent_id) && (
                <>
                  <ChevronRight size={10} />
                  <span className="truncate">{nameMap.get(cat.parent_id)}</span>
                </>
              )}
            </div>
          </div>

          {/* Right: Actions */}
          <div className="flex shrink-0 items-center gap-1">
            {hasPermission("category.update") && (
              <button
                onClick={() => onEdit(cat)}
                className="rounded-xl p-2 text-gray-400 transition-colors active:bg-blue-50 active:text-blue-600"
              >
                <Pencil size={16} />
              </button>
            )}
            {hasPermission("category.delete") && (
              <button
                onClick={() => onDelete(cat)}
                className="rounded-xl p-2 text-gray-400 transition-colors active:bg-red-50 active:text-red-500"
              >
                <Trash2 size={16} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
