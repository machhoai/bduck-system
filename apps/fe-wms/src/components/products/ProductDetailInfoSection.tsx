"use client";

import { Package } from "lucide-react";
import type { Product, ProductCategory } from "@bduck/shared-types";
import type { Dictionary } from "@/lib/i18n";
import {
  formatProductDetailDate,
  formatProductDetailNumber,
} from "@/utils/productDetailFormat";

function DetailRow({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-2">
      <p className="text-xxs font-medium text-[var(--color-text-muted)]">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-medium text-[var(--color-text-primary)]">
        {value ? String(value) : "-"}
      </p>
    </div>
  );
}

export function ProductDetailInfoSection({
  product,
  category,
  labels,
  typeLabel,
  canViewPrice,
}: {
  product: Product;
  category?: ProductCategory | null;
  labels: Dictionary["productDetail"];
  typeLabel: string;
  canViewPrice: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Package size={18} className="text-[var(--color-brand-primary)]" />
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {labels.productInfo}
        </h3>
      </div>
      <div className="grid grid-cols-2 gap-2 ">
        <DetailRow label={labels.code} value={product.code} />
        <DetailRow label={labels.barcode} value={product.barcode} />
        <DetailRow
          label={labels.category}
          value={category ? `${category.name} (${category.code})` : null}
        />
        <DetailRow label={labels.type} value={typeLabel} />
        <DetailRow label={labels.origin} value={product.product_origin} />
        <DetailRow label={labels.material} value={product.product_material} />
        <DetailRow label={labels.hsCode} value={product.hs_code} />
        <DetailRow label={labels.dimensions} value={product.dimensions} />
        <DetailRow label={labels.manufacturer} value={product.manufacturer} />
        <DetailRow
          label={labels.applicableStandard}
          value={product.applicable_standard}
        />
        <DetailRow label={labels.unit} value={product.unit} />
        {canViewPrice && (
          <DetailRow
            label={labels.price}
            value={
              product.unit_price != null
                ? `${formatProductDetailNumber(product.unit_price)} VND`
                : null
            }
          />
        )}
        <DetailRow
          label={labels.serial}
          value={product.is_serialized ? labels.yes : labels.no}
        />
        <DetailRow
          label={labels.createdAt}
          value={formatProductDetailDate(product.created_at)}
        />
        <DetailRow
          label={labels.updatedAt}
          value={formatProductDetailDate(product.updated_at)}
        />
      </div>
      {product.description && (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
          <p className="text-xxs font-medium text-[var(--color-text-muted)]">
            {labels.description}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-primary)]">
            {product.description}
          </p>
        </div>
      )}
      {product.technical_specifications && (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
          <p className="text-xxs font-medium text-[var(--color-text-muted)]">
            {labels.technicalSpecifications}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-primary)]">
            {product.technical_specifications}
          </p>
        </div>
      )}
      {product.manufacturer_address && (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
          <p className="text-xxs font-medium text-[var(--color-text-muted)]">
            {labels.manufacturerAddress}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-primary)]">
            {product.manufacturer_address}
          </p>
        </div>
      )}
      {product.notes && (
        <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
          <p className="text-xxs font-medium text-[var(--color-text-muted)]">
            {labels.notes}
          </p>
          <p className="mt-1 text-sm text-[var(--color-text-primary)]">
            {product.notes}
          </p>
        </div>
      )}
    </section>
  );
}
