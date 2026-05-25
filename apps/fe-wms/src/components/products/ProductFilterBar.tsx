"use client";

import { Filter, Search, X } from "lucide-react";
import { ProductOrigin, ProductType } from "@bduck/shared-types";
import type { ProductCategory } from "@bduck/shared-types";
import type { ReactNode } from "react";
import { useTranslation } from "@/lib/i18n";
import {
  defaultProductFilters,
  type ProductFilters,
} from "@/utils/productFilters";

interface ProductFilterBarProps {
  filters: ProductFilters;
  categories: ProductCategory[];
  resultCount: number;
  totalCount: number;
  onChange: (filters: ProductFilters) => void;
}

export function ProductFilterBar({
  filters,
  categories,
  resultCount,
  totalCount,
  onChange,
}: ProductFilterBarProps) {
  const { t } = useTranslation();
  const updateFilter = <K extends keyof ProductFilters>(
    key: K,
    value: ProductFilters[K],
  ) => onChange({ ...filters, [key]: value });

  return (
    <div className="space-y-3 rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
          />
          <input
            type="text"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            placeholder={t.products.searchPlaceholder}
            className="h-11 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-11 pr-4 text-[17px] text-[var(--color-text-primary)] outline-none transition-colors placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-border-focus)]"
          />
        </div>

        <div className="flex items-center gap-2 text-[14px] font-normal text-[var(--color-text-muted)]">
          <Filter size={15} />
          {resultCount}/{totalCount} {t.products.items}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
        <SelectFilter
          label={t.categories.title}
          value={filters.categoryId}
          onChange={(value) => updateFilter("categoryId", value)}
        >
          <option value="all">{t.products.allCategories}</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </SelectFilter>

        <SelectFilter
          label={t.categories.type}
          value={filters.productType}
          onChange={(value) => updateFilter("productType", value)}
        >
          <option value="all">{t.products.allTypes}</option>
          {Object.values(ProductType).map((type) => (
            <option key={type} value={type}>
              {t.categories.types[type as keyof typeof t.categories.types] ||
                type}
            </option>
          ))}
        </SelectFilter>

        <SelectFilter
          label={t.products.origin}
          value={filters.origin}
          onChange={(value) => updateFilter("origin", value)}
        >
          <option value="all">{t.products.allOrigins}</option>
          {Object.values(ProductOrigin).map((origin) => (
            <option key={origin} value={origin}>
              {origin}
            </option>
          ))}
        </SelectFilter>

        <SelectFilter
          label={t.products.serialized}
          value={filters.serialized}
          onChange={(value) =>
            updateFilter("serialized", value as ProductFilters["serialized"])
          }
        >
          <option value="all">{t.products.allTracking}</option>
          <option value="serialized">{t.products.serializedOnly}</option>
          <option value="standard">{t.products.standardOnly}</option>
        </SelectFilter>

        <SelectFilter
          label={t.products.minStock}
          value={filters.stock}
          onChange={(value) =>
            updateFilter("stock", value as ProductFilters["stock"])
          }
        >
          <option value="all">{t.products.allStock}</option>
          <option value="configured">{t.products.stockConfigured}</option>
          <option value="missing">{t.products.stockMissing}</option>
        </SelectFilter>
      </div>

      <button
        type="button"
        onClick={() => onChange(defaultProductFilters)}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-pearl)] px-4 text-[14px] font-normal text-[var(--color-text-secondary)] transition-all hover:bg-white active:scale-95"
      >
        <X size={14} />
        {t.products.clearFilters}
      </button>
    </div>
  );
}

function SelectFilter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="min-w-0 space-y-1">
      <span className="block text-xs font-normal text-[var(--color-text-muted)]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)]"
      >
        {children}
      </select>
    </label>
  );
}
