"use client";

import { FolderTree } from "lucide-react";
import type { ProductCategory } from "@bduck/shared-types";

interface CategoryDragOverlayProps {
  category: ProductCategory | null;
}

export default function CategoryDragOverlay({
  category,
}: CategoryDragOverlayProps) {
  if (!category) return null;

  return (
    <div
      className="
        flex min-w-64 items-center gap-3 rounded-lg border border-[var(--color-border-subtle)]
        bg-[var(--color-surface-elevated)] px-3 py-2 shadow-xl
      "
    >
      <FolderTree
        size={18}
        className="shrink-0 text-[var(--color-brand-primary)]"
      />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
          {category.name}
        </p>
        <p className="truncate text-xs text-[var(--color-text-muted)]">
          {category.code}
        </p>
      </div>
    </div>
  );
}
