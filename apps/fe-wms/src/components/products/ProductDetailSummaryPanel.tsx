"use client";

import { Image as ImageIcon } from "lucide-react";
import type { Product } from "@bduck/shared-types";
import type { Dictionary } from "@/lib/i18n";
import type { ProductStockSummary } from "@/utils/productStockDetail";
import { formatProductDetailNumber } from "@/utils/productDetailFormat";

function MetricCard({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-pearl)]">
            <p className="text-xs font-medium mr-2 text-[var(--color-text-muted)]">
                {label}
            </p>
            <p className="mt-1 text-xl font-bold mr-2 text-[var(--color-text-primary)]">
                {formatProductDetailNumber(value)}
            </p>
        </div>
    );
}

function MetricCardHighlight({ label, value }: { label: string; value: number }) {
    return (
        <div className="flex flex-col items-center justify-center rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-brand-primary)]">
            <p className="text-xs font-medium mr-1 text-white">
                {label}
            </p>
            <p className="mt-1 text-xl font-bold mr-1 text-white">
                {formatProductDetailNumber(value)}
            </p>
        </div>
    );
}

export function ProductDetailSummaryPanel({
    product,
    stockSummary,
    labels,
}: {
    product: Product;
    stockSummary: ProductStockSummary;
    labels: Dictionary["productDetail"];
}) {
    const primaryImage = product.product_image_url?.[0] ?? null;
    const images = product.product_image_url ?? [];

    return (
        <div className="flex w-full gap-2">
            <div className="overflow-hidden flex-1 w-full rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)]">
                <div className="aspect-square">
                    {primaryImage ? (
                        <img
                            src={primaryImage}
                            alt={product.name}
                            className="h-full w-full object-cover"
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center">
                            <ImageIcon
                                size={48}
                                className="text-[var(--color-text-muted)]"
                            />
                        </div>
                    )}
                </div>
            </div>

            {images.length > 1 && (
                <div className="grid grid-cols-4 gap-2">
                    {images.slice(0, 8).map((url, index) => (
                        <img
                            key={`${url}-${index}`}
                            src={url}
                            alt={`${product.name} ${index + 1}`}
                            className="aspect-square rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] object-cover"
                        />
                    ))}
                </div>
            )}

            <div className="grid shrink-0 flex-1 grid-cols-2 gap-2">
                <MetricCardHighlight label={labels.totalStock} value={stockSummary.total} />
                <MetricCard label={labels.atp} value={stockSummary.atp} />
                <MetricCard label={labels.onHold} value={stockSummary.onHold} />
                <MetricCard label={labels.quarantine} value={stockSummary.quarantine} />
            </div>
        </div>
    );
}
