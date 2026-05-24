"use client";

import { Edit2, Image as ImageIcon, Package, Trash2 } from "lucide-react";
import type { Product, ProductCategory } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

interface ProductCardProps {
  product: Product;
  category?: ProductCategory;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
}

export function ProductCard({
  product,
  category,
  onEdit,
  onDelete,
}: ProductCardProps) {
  const { t } = useTranslation();
  const primaryImage = product.product_image_url?.[0] || null;
  const typeLabel =
    t.categories.types[
      product.product_type as keyof typeof t.categories.types
    ] || product.product_type;

  return (
    <article className="group overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md">
      <div className="relative aspect-[4/3] bg-gray-100">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
            <ImageIcon size={42} className="text-gray-300" />
          </div>
        )}

        <div className="absolute left-3 top-3 rounded-md bg-white/95 px-2 py-1 text-xs font-semibold text-gray-900 shadow-sm">
          {product.code}
        </div>

        <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white text-blue-700 shadow-sm transition-colors hover:bg-blue-50"
            title={t.common.edit}
          >
            <Edit2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(product)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white text-red-600 shadow-sm transition-colors hover:bg-red-50"
            title={t.common.delete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="min-h-[3.25rem]">
          <h3 className="line-clamp-2 text-sm font-semibold leading-5 text-gray-950">
            {product.name}
          </h3>
          <p className="mt-1 line-clamp-1 text-xs text-gray-500">
            {category
              ? `${category.name} (${category.code})`
              : t.products.noCategory}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
            {typeLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700">
            {product.unit}
          </span>
          {product.is_serialized && (
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              Serial
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-md bg-gray-50 p-2 text-xs">
          <div>
            <p className="text-gray-500">{t.products.origin}</p>
            <p className="mt-0.5 truncate font-medium text-gray-800">
              {product.product_origin || t.common.noData}
            </p>
          </div>
          <div>
            <p className="text-gray-500">{t.products.minStock}</p>
            <p className="mt-0.5 truncate font-medium text-gray-800">
              {product.min_stock_threshold ?? t.common.noData}
            </p>
          </div>
        </div>

        {product.barcode && (
          <div className="flex items-center gap-2 border-t border-gray-100 pt-2 text-xs text-gray-500">
            <Package size={14} />
            <span className="truncate">{product.barcode}</span>
          </div>
        )}
      </div>
    </article>
  );
}
