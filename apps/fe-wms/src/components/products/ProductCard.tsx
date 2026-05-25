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
    <article className="group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] transition-colors duration-200 hover:border-[var(--color-brand-primary)]/40">
      <div className="relative aspect-[4/3] bg-[var(--color-surface-card)]">
        {primaryImage ? (
          <img
            src={primaryImage}
            alt={product.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[var(--color-surface-card)]">
            <ImageIcon size={42} className="text-[var(--color-text-muted)]" />
          </div>
        )}

        <div className="absolute left-3 top-3 rounded-full border border-[var(--color-border-subtle)] bg-white/95 px-2.5 py-1 text-xs font-normal text-[var(--color-text-primary)] backdrop-blur-xl">
          {product.code}
        </div>

        <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
          <button
            type="button"
            onClick={() => onEdit(product)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white text-[var(--color-brand-primary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
            title={t.common.edit}
          >
            <Edit2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(product)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white text-[var(--color-accent-error)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
            title={t.common.delete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="space-y-3 p-3">
        <div className="min-h-[3.25rem]">
          <h3 className="line-clamp-2 text-[17px] font-semibold leading-[1.24] tracking-[-0.374px] text-[var(--color-text-primary)]">
            {product.name}
          </h3>
          <p className="mt-1 line-clamp-1 text-[14px] leading-[1.43] tracking-[-0.224px] text-[var(--color-text-muted)]">
            {category
              ? `${category.name} (${category.code})`
              : t.products.noCategory}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center rounded-full border border-[var(--color-brand-primary)] px-2 py-1 text-xs font-normal text-[var(--color-brand-primary)]">
            {typeLabel}
          </span>
          <span className="inline-flex items-center rounded-full bg-[var(--color-surface-card)] px-2 py-1 text-xs font-normal text-[var(--color-text-secondary)]">
            {product.unit}
          </span>
          {product.is_serialized && (
            <span className="inline-flex items-center rounded-full bg-[var(--color-surface-card)] px-2 py-1 text-xs font-normal text-[var(--color-text-secondary)]">
              {t.products.serialized}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-2 text-xs">
          <div>
            <p className="text-[var(--color-text-muted)]">{t.products.origin}</p>
            <p className="mt-0.5 truncate font-normal text-[var(--color-text-primary)]">
              {product.product_origin || t.common.noData}
            </p>
          </div>
          <div>
            <p className="text-[var(--color-text-muted)]">{t.products.minStock}</p>
            <p className="mt-0.5 truncate font-normal text-[var(--color-text-primary)]">
              {product.min_stock_threshold ?? t.common.noData}
            </p>
          </div>
        </div>

        {product.barcode && (
          <div className="flex items-center gap-2 border-t border-[var(--color-border-soft)] pt-2 text-xs text-[var(--color-text-muted)]">
            <Package size={14} />
            <span className="truncate">{product.barcode}</span>
          </div>
        )}
      </div>
    </article>
  );
}
