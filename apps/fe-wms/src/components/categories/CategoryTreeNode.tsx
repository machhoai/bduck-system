"use client";

import { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import type { ProductCategory } from "@bduck/shared-types";
import { useTranslation } from "../../lib/i18n";
import type { CategoryTreeNode as CategoryTreeNodeData } from "../../utils/categoryTree";
import {
  getCategoryDropZoneId,
  type CategoryDropIntent,
} from "../../utils/categoryDnd";
import CategoryDropIndicator from "./CategoryDropIndicator";

interface CategoryTreeNodeProps {
  node: CategoryTreeNodeData;
  activeDropIntent: CategoryDropIntent | null;
  isDropInvalid: boolean;
  onEdit: (category: ProductCategory) => void;
  onDelete: (category: ProductCategory) => void;
  hasPermission: (action: string) => boolean;
}

export default function CategoryTreeNode({
  node,
  activeDropIntent,
  isDropInvalid,
  onEdit,
  onDelete,
  hasPermission,
}: CategoryTreeNodeProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  const hasChildren = node.children.length > 0;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: node.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const aboveDropId = getCategoryDropZoneId(node.id, "above");
  const intoDropId = getCategoryDropZoneId(node.id, "into");
  const belowDropId = getCategoryDropZoneId(node.id, "below");
  const isDropActive = (position: "above" | "into" | "below") =>
    activeDropIntent?.targetId === node.id &&
    activeDropIntent.position === position;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={isDragging ? "opacity-40" : ""}
    >
      <CategoryDropIndicator
        id={aboveDropId}
        position="above"
        isActive={isDropActive("above")}
        isInvalid={isDropInvalid}
      />

      <CategoryDropIndicator
        id={intoDropId}
        position="into"
        isActive={isDropActive("into")}
        isInvalid={isDropInvalid}
      >
        <div
          className="
            group mx-2 flex min-h-12 items-center gap-2 rounded-lg border border-transparent
            px-2.5 py-2 transition-all duration-150
            hover:border-[var(--color-border-subtle)] hover:bg-[var(--color-surface-card)]
          "
          style={{ paddingLeft: `${10 + (node.depth - 1) * 24}px` }}
        >
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="
              flex h-8 w-7 shrink-0 cursor-grab items-center justify-center rounded-md
              text-[var(--color-text-muted)] transition-colors
              hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]
              active:cursor-grabbing
            "
            title={node.name}
          >
            <GripVertical size={16} strokeWidth={1.7} />
          </button>

          <button
            type="button"
            onClick={() => setIsExpanded((value) => !value)}
            disabled={!hasChildren}
            className={`
              flex h-7 w-7 shrink-0 items-center justify-center rounded-md
              text-[var(--color-text-muted)] transition-colors
              ${
                hasChildren
                  ? "hover:bg-[var(--color-surface-elevated)] hover:text-[var(--color-text-primary)]"
                  : "invisible"
              }
            `}
          >
            {isExpanded ? (
              <ChevronDown size={16} strokeWidth={1.8} />
            ) : (
              <ChevronRight size={16} strokeWidth={1.8} />
            )}
          </button>

          {hasChildren ? (
            <FolderOpen
              size={18}
              className="shrink-0 text-[var(--color-brand-primary)]"
            />
          ) : (
            <Folder
              size={18}
              className="shrink-0 text-[var(--color-text-muted)]"
            />
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
              {node.name}
            </p>
            <p className="truncate text-xs text-[var(--color-text-muted)]">
              {node.code}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            {hasPermission("category.update") && (
              <button
                type="button"
                onClick={() => onEdit(node)}
                className="
                  flex h-8 w-8 items-center justify-center rounded-md
                  text-[var(--color-text-muted)] transition-colors
                  hover:bg-[var(--color-accent-info)]/10 hover:text-[var(--color-accent-info)]
                "
                title={t.common.edit}
              >
                <Pencil size={15} strokeWidth={1.7} />
              </button>
            )}
            {hasPermission("category.delete") && (
              <button
                type="button"
                onClick={() => onDelete(node)}
                className="
                  flex h-8 w-8 items-center justify-center rounded-md
                  text-[var(--color-text-muted)] transition-colors
                  hover:bg-[var(--color-accent-error)]/10 hover:text-[var(--color-accent-error)]
                "
                title={t.common.delete}
              >
                <Trash2 size={15} strokeWidth={1.7} />
              </button>
            )}
          </div>
        </div>
      </CategoryDropIndicator>

      {isExpanded && hasChildren && (
        <div className="transition-all duration-200">
          {node.children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              activeDropIntent={activeDropIntent}
              isDropInvalid={isDropInvalid}
              onEdit={onEdit}
              onDelete={onDelete}
              hasPermission={hasPermission}
            />
          ))}
        </div>
      )}

      <CategoryDropIndicator
        id={belowDropId}
        position="below"
        isActive={isDropActive("below")}
        isInvalid={isDropInvalid}
      />
    </div>
  );
}
