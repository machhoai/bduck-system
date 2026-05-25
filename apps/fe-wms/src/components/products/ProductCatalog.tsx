"use client";

import { Package, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import type { Product, ProductCategory } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import {
  defaultProductFilters,
  filterProducts,
  type ProductFilters,
} from "@/utils/productFilters";
import { ProductCard } from "./ProductCard";
import { ProductFilterBar } from "./ProductFilterBar";
import { ProductGridSkeleton } from "./ProductCardSkeleton";

interface ProductCatalogProps {
  products: Product[];
  categories: ProductCategory[];
  loading: boolean;
  onAddNew: () => void;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductCatalog({
  products,
  categories,
  loading,
  onAddNew,
  onEdit,
  onDelete,
}: ProductCatalogProps) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<ProductFilters>(defaultProductFilters);
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const filteredProducts = useMemo(
    () => filterProducts(products, categories, filters),
    [products, categories, filters],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">
            {t.products.catalog}
          </h2>
          <p className="text-sm text-gray-500">{t.products.catalogHint}</p>
        </div>
        <button
          type="button"
          onClick={onAddNew}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          <Plus size={18} />
          {t.products.addNew}
        </button>
      </div>

      <ProductFilterBar
        filters={filters}
        categories={categories}
        resultCount={filteredProducts.length}
        totalCount={products.length}
        onChange={setFilters}
      />

      {loading ? (
        <ProductGridSkeleton />
      ) : filteredProducts.length === 0 ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-dashed border-gray-200 bg-white px-4 py-12 text-center">
          <Package size={42} className="mb-3 text-gray-300" />
          <h3 className="text-sm font-semibold text-gray-900">
            {t.products.empty}
          </h3>
          <p className="mt-1 text-sm text-gray-500">{t.products.emptyHint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              category={categoryById.get(product.category_id)}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </section>
  );
}
