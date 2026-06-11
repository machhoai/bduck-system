"use client";

import { Search } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useState } from "react";
import type { ProductCategory } from "@bduck/shared-types";
import { useCategories } from "@/hooks/useCategories";
import { emitDataMutation } from "@/lib/dataInvalidation";
import { useTranslation } from "@/lib/i18n";
import { useUserStore } from "@/stores/useUserStore";
import { createDetailedApiError } from "@/utils/apiError";
import CategorySkeleton from "./CategorySkeleton";
import CategoryTreeView from "./CategoryTreeView";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://api.wms.localhost";

export function CategoryManagementPanel() {
  const { t } = useTranslation();
  const { categories, isLoading } = useCategories();
  const hasPermission = useUserStore((s) => s.hasPermission);
  const [searchQuery, setSearchQuery] = useState("");

  const handleDelete = async (category: ProductCategory) => {
    if (
      !confirm(`${t.categories.confirmDelete}\n${t.categories.deleteWarning}`)
    ) {
      return;
    }

    const deleteAction = async () => {
      const response = await fetch(
        `${API_BASE_URL}/api/categories/${category.id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw createDetailedApiError(response, errorData, t.categories.deleteError);
      }
    };

    try {
      await gooeyToast.promise(deleteAction(), {
        loading: t.categories.deleting,
        success: t.categories.deleteSuccess,
        error: (error: unknown) =>
          error instanceof Error ? error.message : t.categories.deleteError,
        action: {
          error: {
            label: t.common.retry,
            onClick: () => handleDelete(category),
          },
        },
      });
      emitDataMutation(["product_categories", "products", "audit_logs"]);
    } catch (error) {
      console.error("[CategoryManagementPanel] delete error:", error);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-base font-semibold leading-[1.19] tracking-normal text-[var(--color-text-primary)]">
          {t.categories.title}
        </h2>
        <p className="text-sm text-gray-500">{t.products.categoryHint}</p>
      </div>

      <div className="relative">
        <Search
          size={18}
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder={t.common.search}
          className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-10 pr-4 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {isLoading ? (
        <CategorySkeleton />
      ) : (
        <CategoryTreeView
          categories={categories}
          searchQuery={searchQuery}
          onDelete={handleDelete}
          hasPermission={hasPermission}
        />
      )}
    </section>
  );
}
