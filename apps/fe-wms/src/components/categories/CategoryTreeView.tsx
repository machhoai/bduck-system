"use client";

import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { FolderOpen, Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { gooeyToast } from "goey-toast";
import type { ProductCategory } from "@bduck/shared-types";
import { emitDataMutation } from "@/lib/dataInvalidation";
import { useTranslation } from "../../lib/i18n";
import {
  applyOptimisticCategoryMove,
  didParentChange,
  getRootDropZoneId,
  resolveCategoryDropIntent,
  validateCategoryDrop,
  type CategoryDropIntent,
} from "../../utils/categoryDnd";
import {
  buildCategoryTree,
  filterCategoriesForTree,
  flattenCategoryTree,
} from "../../utils/categoryTree";
import CategoryDragOverlay from "./CategoryDragOverlay";
import CategoryDropIndicator from "./CategoryDropIndicator";
import CategoryFormModal from "./CategoryFormModal";
import CategoryTreeNode from "./CategoryTreeNode";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

interface CategoryTreeViewProps {
  categories: ProductCategory[];
  searchQuery: string;
  onDelete: (category: ProductCategory) => void;
  hasPermission: (action: string) => boolean;
}

export default function CategoryTreeView({
  categories,
  searchQuery,
  onDelete,
  hasPermission,
}: CategoryTreeViewProps) {
  const { t } = useTranslation();
  const [localCategories, setLocalCategories] =
    useState<ProductCategory[]>(categories);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeDropIntent, setActiveDropIntent] =
    useState<CategoryDropIntent | null>(null);
  const [isDropInvalid, setIsDropInvalid] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<ProductCategory | null>(
    null,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor),
  );

  useEffect(() => {
    setLocalCategories(categories);
  }, [categories]);

  const visibleCategories = useMemo(
    () => filterCategoriesForTree(localCategories, searchQuery),
    [localCategories, searchQuery],
  );
  const tree = useMemo(
    () => buildCategoryTree(visibleCategories),
    [visibleCategories],
  );
  const flatNodes = useMemo(() => flattenCategoryTree(tree), [tree]);
  const activeCategory = activeId
    ? localCategories.find((category) => category.id === activeId) || null
    : null;

  const openAddRootModal = () => {
    setEditCategory(null);
    setIsModalOpen(true);
  };

  const openEditModal = (category: ProductCategory) => {
    setEditCategory(category);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditCategory(null);
  };

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveId(String(active.id));
  };

  const handleDragOver = ({ active, over }: DragOverEvent) => {
    const intent = resolveCategoryDropIntent({
      draggedId: String(active.id),
      overId: over ? String(over.id) : null,
      categories: localCategories,
    });

    if (!intent) {
      setActiveDropIntent(null);
      setIsDropInvalid(false);
      return;
    }

    const validation = validateCategoryDrop(localCategories, intent);
    setActiveDropIntent(intent);
    setIsDropInvalid(!validation.valid);
  };

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    const intent =
      activeDropIntent ||
      resolveCategoryDropIntent({
        draggedId: String(active.id),
        overId: over ? String(over.id) : null,
        categories: localCategories,
      });

    setActiveId(null);
    setActiveDropIntent(null);
    setIsDropInvalid(false);

    if (!intent) return;

    const validation = validateCategoryDrop(localCategories, intent);
    if (!validation.valid) {
      if (validation.reason === "MAX_DEPTH") {
        gooeyToast.error(t.categories.maxDepthError, {
          description: t.categories.maxDepthDescription,
          preset: "snappy",
          timing: { displayDuration: 6000 },
        });
      }
      return;
    }

    const previousCategories = localCategories;
    const nextCategories = applyOptimisticCategoryMove(localCategories, intent);
    setLocalCategories(nextCategories);

    if (!didParentChange(previousCategories, intent)) return;

    try {
      await runMoveRequestWithToast(previousCategories, nextCategories, intent);
    } catch (error) {
      console.error("[CategoryTreeView] move error:", error);
      setLocalCategories(previousCategories);
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setActiveDropIntent(null);
    setIsDropInvalid(false);
  };

  const persistCategoryMove = async (intent: CategoryDropIntent) => {
    const response = await fetch(
      `${API_BASE_URL}/api/categories/${intent.draggedId}`,
      {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parent_id: intent.nextParentId }),
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.messages?.vi || t.categories.moveError);
    }

    emitDataMutation(["product_categories", "products", "audit_logs"]);
  };

  const runMoveRequestWithToast = async (
    previousCategories: ProductCategory[],
    nextCategories: ProductCategory[],
    intent: CategoryDropIntent,
  ) => {
    await gooeyToast.promise(persistCategoryMove(intent), {
      loading: t.categories.moving,
      success: t.categories.moveSuccess,
      error: (error: unknown) =>
        error instanceof Error ? error.message : t.categories.moveError,
      description: {
        success: t.categories.moveSuccessDescription,
        error: t.categories.moveErrorDescription,
      },
      action: {
        error: {
          label: t.common.retry,
          onClick: async () => {
            setLocalCategories(nextCategories);
            try {
              await runMoveRequestWithToast(
                previousCategories,
                nextCategories,
                intent,
              );
            } catch {
              setLocalCategories(previousCategories);
            }
          },
        },
      },
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-[var(--color-text-secondary)]">
          {t.categories.title}
        </div>
        {hasPermission("category.create") && (
          <button
            type="button"
            onClick={openAddRootModal}
            className="
              inline-flex min-h-8 items-center gap-2 rounded-lg
              bg-[var(--color-brand-primary)] px-3 text-sm font-semibold text-[#0A0A0F]
              transition-all duration-150 hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98]
            "
          >
            <Plus size={17} strokeWidth={1.9} />
            {t.categories.addRoot}
          </button>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <SortableContext
          items={flatNodes.map((node) => node.id)}
          strategy={verticalListSortingStrategy}
        >
          <CategoryDropIndicator
            id={getRootDropZoneId()}
            position="root"
            isActive={activeDropIntent?.position === "root"}
            isInvalid={isDropInvalid}
          >
            <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] py-2">
              {tree.length === 0 ? (
                <EmptyState />
              ) : (
                tree.map((node) => (
                  <CategoryTreeNode
                    key={node.id}
                    node={node}
                    activeDropIntent={activeDropIntent}
                    isDropInvalid={isDropInvalid}
                    onEdit={openEditModal}
                    onDelete={onDelete}
                    hasPermission={hasPermission}
                  />
                ))
              )}
            </div>
          </CategoryDropIndicator>
        </SortableContext>

        <DragOverlay>
          <CategoryDragOverlay category={activeCategory} />
        </DragOverlay>
      </DndContext>

      <CategoryFormModal
        isOpen={isModalOpen}
        onClose={closeModal}
        editCategory={editCategory}
        parentOptions={localCategories}
      />
    </div>
  );
}

function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <FolderOpen size={42} className="mb-3 text-[var(--color-text-muted)]" />
      <p className="text-sm text-[var(--color-text-muted)]">
        {t.categories.empty}
      </p>
    </div>
  );
}
