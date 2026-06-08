"use client";

/**
 * ProductCard — Shared component dùng chung toàn hệ thống
 *
 * Hỗ trợ 2 variant:
 *   - "catalog"   → Dùng trong trang Sản phẩm (hiển thị nút Edit/Delete)
 *   - "inventory" → Dùng trong tab Tồn kho kho hàng (hiển thị stock breakdown)
 *
 * RBAC: Đơn giá (unit_price) chỉ hiển thị khi user có permission "products.price.view".
 */

import Image from "next/image";
import {
  Edit2,
  Image as ImageIcon,
  MapPin,
  Package,
  Trash2,
} from "lucide-react";
import type {
  InventoryStockPolicy,
  Product,
  ProductCategory,
} from "@bduck/shared-types";
import { ProductType } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { useProductPermissions } from "@/hooks/useProductPermissions";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ProductStockInfo {
  atp: number;
  onHold: number;
  inTransit: number;
  quarantine: number;
  total: number;
}

export interface ProductStockLocationInfo {
  locationId: string;
  name: string;
  code: string;
  atp: number;
  total: number;
}

interface CatalogVariantProps {
  variant: "catalog";
  category?: ProductCategory;
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  stockInfo?: never;
}

interface InventoryVariantProps {
  variant: "inventory";
  category?: ProductCategory;
  stockInfo: ProductStockInfo;
  stockLocations?: ProductStockLocationInfo[];
  stockPolicy?: InventoryStockPolicy | null;
  onEdit?: never;
  onDelete?: never;
}

type ProductCardProps = {
  product: Product;
} & (CatalogVariantProps | InventoryVariantProps);

// ── Styles theo ProductType ─────────────────────────────────────────────────

const TYPE_GRADIENT: Record<string, string> = {
  [ProductType.EQUIPMENT]: "from-blue-50 to-blue-100",
  [ProductType.SOUVENIR_SALE]: "from-green-50 to-green-100",
  [ProductType.SOUVENIR_GIFT]: "from-purple-50 to-purple-100",
};

const TYPE_BADGE: Record<string, string> = {
  [ProductType.EQUIPMENT]: "bg-blue-100 text-blue-700 border-blue-200",
  [ProductType.SOUVENIR_SALE]: "bg-green-100 text-green-700 border-green-200",
  [ProductType.SOUVENIR_GIFT]:
    "bg-purple-100 text-purple-700 border-purple-200",
};

// ── Sub-components ──────────────────────────────────────────────────────────

function PriceCell({
  price,
  unit,
  canViewPrice,
  label,
}: {
  price: number | null;
  unit: string;
  canViewPrice: boolean;
  label: string;
}) {
  if (!canViewPrice) return null;
  return (
    <div className="col-span-2">
      <div className="text-xxs text-[var(--color-text-muted)]">{label}</div>
      <div className="text-xs font-medium text-[var(--color-text-secondary)]">
        {price != null
          ? `${new Intl.NumberFormat("vi-VN").format(price)}₫/${unit}`
          : "—"}
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function ProductCard(props: ProductCardProps) {
  const { product } = props;
  const { t } = useTranslation();
  const { canViewPrice, canWrite } = useProductPermissions();

  const primaryImage = product.product_image_url?.[0] ?? null;
  const typeGradient =
    TYPE_GRADIENT[product.product_type] ?? "from-gray-50 to-gray-100";
  const typeBadge =
    TYPE_BADGE[product.product_type] ??
    "bg-gray-100 text-gray-600 border-gray-200";
  const typeLabel =
    (t.inventoryDashboard.productTypes as Record<string, string>)[
      product.product_type
    ] ?? product.product_type;

  // Inventory variant
  if (props.variant === "inventory") {
    const s = props.stockInfo;
    const policy = props.stockPolicy ?? null;
    const stockLocations = props.stockLocations ?? [];
    const visibleLocations = stockLocations.slice(0, 3);
    const isLowAtp = s.atp <= 0;
    const hasQuarantine = s.quarantine > 0;
    const d = t.warehouses.inventoryView as Record<string, string>;

    return (
      <article className="group flex flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] transition-shadow hover:shadow-md">
        {/* Image */}
        <div
          className={`relative aspect-square w-full shrink-0 bg-gradient-to-br ${typeGradient}`}
        >
          {primaryImage ? (
            <Image
              src={primaryImage}
              alt={product.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, 25vw"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-3xl font-bold opacity-20 select-none">
              {product.code.slice(0, 2).toUpperCase()}
            </div>
          )}
          {hasQuarantine && (
            <div className="absolute left-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-micro font-semibold text-white shadow">
              ⚠ {d.quarantine} {s.quarantine}
            </div>
          )}
          <div
            className={`absolute right-2 top-2 rounded-lg px-2 py-1 text-xs font-bold shadow ${isLowAtp ? "bg-red-500 text-white" : "bg-white/90 text-[var(--color-brand-primary)]"}`}
          >
            {s.atp.toLocaleString()} {d.atp}
          </div>
        </div>

        {/* Content */}
        <div className="flex flex-1 flex-col gap-2 p-3">
          <span
            className={`w-fit rounded-full border px-2 py-0.5 text-micro font-semibold ${typeBadge}`}
          >
            {typeLabel}
          </span>
          <div>
            <p className="line-clamp-2 text-sm font-semibold leading-tight text-[var(--color-text-primary)]">
              {product.name}
            </p>
            <p className="mt-0.5 text-xxs text-[var(--color-text-muted)]">
              {product.code}
            </p>
          </div>
          {visibleLocations.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border-soft)] bg-[var(--color-surface-pearl)] p-2">
              <div className="mb-1.5 flex items-center gap-1.5 text-xxs font-semibold text-[var(--color-text-secondary)]">
                <MapPin size={12} />
                <span>Vị trí lưu trữ</span>
              </div>
              <div className="flex flex-col gap-1">
                {visibleLocations.map((location) => (
                  <div
                    key={location.locationId}
                    className="flex min-w-0 items-center justify-between gap-2 text-xxs"
                  >
                    <span className="truncate text-[var(--color-text-secondary)]">
                      {location.code} · {location.name}
                    </span>
                    <span className="shrink-0 font-bold text-[var(--color-text-primary)]">
                      {location.total.toLocaleString()}
                    </span>
                  </div>
                ))}
                {stockLocations.length > visibleLocations.length && (
                  <div className="text-xxs font-medium text-[var(--color-brand-primary)]">
                    +{stockLocations.length - visibleLocations.length} vị trí
                    khác
                  </div>
                )}
              </div>
            </div>
          )}
          {policy && (
            <div
              className={`rounded-lg border px-2 py-1.5 text-xxs ${
                s.atp < policy.min_stock_quantity
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-[var(--color-border-soft)] bg-[var(--color-surface-pearl)] text-[var(--color-text-secondary)]"
              }`}
            >
              Min kho:{" "}
              <span className="font-bold">
                {policy.min_stock_quantity.toLocaleString()}
              </span>
            </div>
          )}
          <div className="mt-auto grid grid-cols-2 gap-1 rounded-lg bg-[var(--color-surface-card)] p-2">
            <div>
              <div className="text-xxs text-[var(--color-text-muted)]">
                {d.total}
              </div>
              <div className="text-xs font-bold text-[var(--color-text-primary)]">
                {s.total.toLocaleString()}
              </div>
            </div>
            {s.onHold > 0 && (
              <div>
                <div className="text-xxs text-[var(--color-text-muted)]">
                  {d.onHold}
                </div>
                <div className="text-xs font-medium text-amber-600">
                  {s.onHold.toLocaleString()}
                </div>
              </div>
            )}
            {s.inTransit > 0 && (
              <div>
                <div className="text-xxs text-[var(--color-text-muted)]">
                  {d.inTransit}
                </div>
                <div className="text-xs font-medium text-blue-600">
                  {s.inTransit.toLocaleString()}
                </div>
              </div>
            )}
            <PriceCell
              price={product.unit_price ?? null}
              unit={product.unit}
              canViewPrice={canViewPrice}
              label={d.price}
            />
          </div>
        </div>
      </article>
    );
  }

  // Catalog variant (default) — hiển thị nút Edit/Delete cho user có quyền
  return (
    <article className="group overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] transition-colors duration-200 hover:border-[var(--color-brand-primary)]/40">
      <div className="relative aspect-square bg-[var(--color-surface-card)]">
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

        {canWrite && (
          <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
            <button
              type="button"
              onClick={() => props.onEdit(product)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white text-[var(--color-brand-primary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
              title={t.common.edit}
            >
              <Edit2 size={16} />
            </button>
            <button
              type="button"
              onClick={() => props.onDelete(product)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-border-subtle)] bg-white text-[var(--color-accent-error)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
              title={t.common.delete}
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}
      </div>

      <div className="space-y-3 p-3">
        <div className="min-h-[3.25rem]">
          <h3 className="line-clamp-2 text-sm font-semibold leading-[1.24] tracking-normal text-[var(--color-text-primary)]">
            {product.name}
          </h3>
          <p className="mt-1 line-clamp-1 text-sm leading-[1.43] tracking-normal text-[var(--color-text-muted)]">
            {props.category
              ? `${props.category.name} (${props.category.code})`
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
            <p className="text-[var(--color-text-muted)]">
              {t.products.origin}
            </p>
            <p className="mt-0.5 truncate font-normal text-[var(--color-text-primary)]">
              {product.product_origin || t.common.noData}
            </p>
          </div>
          {canViewPrice && (
            <div>
              <p className="text-[var(--color-text-muted)]">
                {(t.warehouses.inventoryView as Record<string, string>).price}
              </p>
              <p className="mt-0.5 truncate font-normal text-[var(--color-text-primary)]">
                {product.unit_price != null
                  ? new Intl.NumberFormat("vi-VN").format(product.unit_price) +
                    " đ"
                  : t.common.noData}
              </p>
            </div>
          )}
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
