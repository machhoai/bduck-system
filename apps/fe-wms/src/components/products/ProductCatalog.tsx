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
import { useExportRegistration } from "@/hooks/useExportRegistration";
import { formatExportDate } from "@/utils/exportExcel";

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

    const exportConfig = useMemo(() => {
        if (!filteredProducts.length) return null;
        return {
            filename: "products",
            entityType: "products",
            filters,
            data: filteredProducts,
            columns: [
                { header: t.products.exportColumns.id, key: "id", width: 35 },
                { header: t.products.exportColumns.category, key: "category_id", width: 35, format: (val: string) => categoryById.get(val)?.name || val },
                { header: t.products.exportColumns.name, key: "name", width: 30 },
                { header: t.products.exportColumns.code, key: "code", width: 20 },
                { header: t.products.exportColumns.barcode, key: "barcode", width: 20 },
                { header: t.products.exportColumns.type, key: "product_type", width: 20 },
                { header: t.products.exportColumns.origin, key: "product_origin", width: 20 },
                { header: t.products.exportColumns.material, key: "product_material", width: 20 },
                { header: t.products.exportColumns.unit, key: "unit", width: 15 },
                { header: t.products.exportColumns.price, key: "unit_price", width: 15 },
                { header: t.products.exportColumns.isSerialized, key: "is_serialized", width: 20, format: (val: boolean) => val ? t.products.exportColumns.yes : t.products.exportColumns.no },
                { header: t.products.exportColumns.description, key: "description", width: 30 },
                { header: t.products.exportColumns.isDeleted, key: "is_deleted", width: 15, format: (val: boolean) => val ? t.products.exportColumns.deleted : t.products.exportColumns.active },
                { header: t.products.exportColumns.createdAt, key: "created_at", width: 25, format: formatExportDate },
                { header: t.products.exportColumns.updatedAt, key: "updated_at", width: 25, format: formatExportDate },
            ],
        };
    }, [filteredProducts, filters, t, categoryById]);

    useExportRegistration(exportConfig);

    return (
        <section className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 className="text-base font-semibold leading-[1.19] tracking-normal text-[var(--color-text-primary)]">
                        {t.products.catalog}
                    </h2>
                    <p className="text-sm text-gray-500">
                        {t.products.catalogHint}
                    </p>
                </div>
                <button
                    type="button"
                    onClick={onAddNew}
                    className="inline-flex min-h-8 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-5 text-sm font-normal text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95"
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
                <div className="flex min-h-72 flex-col items-center justify-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-12 text-center">
                    <Package size={42} className="mb-3 text-[var(--color-text-muted)]" />
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                        {t.products.empty}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                        {t.products.emptyHint}
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 xl:grid-cols-5 2xl:grid-cols-6">
                    {filteredProducts.map((product) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            variant="catalog"
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
