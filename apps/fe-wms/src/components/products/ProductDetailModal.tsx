"use client";

import { X } from "lucide-react";
import type {
    ExportVoucher,
    ImportVoucher,
    Inventory,
    Product,
    ProductCategory,
    Warehouse,
    WarehouseLocation,
    WarehouseLocationSlot,
    WarehouseLocationSlotProduct,
} from "@bduck/shared-types";
import { useProductPermissions } from "@/hooks/useProductPermissions";
import { useProductMovementHistory } from "@/hooks/useProductMovementHistory";
import { useTranslation } from "@/lib/i18n";
import { buildProductStockSummary } from "@/utils/productStockDetail";
import { ProductDetailInfoSection } from "./ProductDetailInfoSection";
import { ProductDetailSummaryPanel } from "./ProductDetailSummaryPanel";
import { ProductMovementHistoryList } from "./ProductMovementHistoryList";
import { ProductStockPlacementList } from "./ProductStockPlacementList";

interface ProductDetailModalProps {
    isOpen: boolean;
    product: Product | null;
    category?: ProductCategory | null;
    inventory: Inventory[];
    warehouses: Warehouse[];
    locations: WarehouseLocation[];
    slots: WarehouseLocationSlot[];
    slotMappings: WarehouseLocationSlotProduct[];
    importVouchers: ImportVoucher[];
    exportVouchers: ExportVoucher[];
    warehouseId?: string;
    onClose: () => void;
}

export function ProductDetailModal({
    isOpen,
    product,
    category,
    inventory,
    warehouses,
    locations,
    slots,
    slotMappings,
    importVouchers,
    exportVouchers,
    warehouseId,
    onClose,
}: ProductDetailModalProps) {
    const { t } = useTranslation();
    const labels = t.productDetail;
    const { canViewPrice } = useProductPermissions();
    const { records, loading } = useProductMovementHistory({
        productId: product?.id,
        warehouseId,
        importVouchers,
        exportVouchers,
        enabled: isOpen,
    });

    if (!isOpen || !product) return null;

    const stockSummary = buildProductStockSummary({
        product,
        inventory,
        warehouses,
        locations,
        slots,
        slotMappings,
        warehouseId,
    });
    const typeLabel =
        (t.inventoryDashboard.productTypes as Record<string, string>)[
        product.product_type
        ] ?? product.product_type;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            role="dialog"
            aria-modal="true"
            aria-label={labels.title}
        >
            <div
                className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm"
                role="dialog"
                aria-modal="true"
                aria-label={labels.title}
                onClick={onClose}
            >

            </div>
            <div className="flex max-h-[92vh] z-50 w-[min(96vw,1120px)] flex-col overflow-hidden rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] shadow-xl">
                <div className="flex items-center justify-between gap-3 px-4 pt-4">
                    <div className="min-w-0">
                        <p className="text-xxs font-semibold tracking-wide text-[var(--color-brand-primary)]">
                            {labels.title}
                        </p>
                        <h2 className="truncate text-base font-semibold text-[var(--color-text-primary)]">
                            {product.name}
                        </h2>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--color-text-muted)] transition-colors hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
                        title={labels.close}
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 pt-2">
                    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto lg:flex-row lg:overflow-hidden">

                        {/* Cột trái: Ảnh & Thông tin */}
                        <div className="flex shrink-0 flex-col gap-6 lg:w-[42%] lg:min-h-0 lg:overflow-y-auto lg:pr-2 lg:custom-scrollbar">
                            <ProductDetailSummaryPanel
                                product={product}
                                stockSummary={stockSummary}
                                labels={labels}
                            />
                            <ProductDetailInfoSection
                                product={product}
                                category={category}
                                labels={labels}
                                typeLabel={typeLabel}
                                canViewPrice={canViewPrice}
                            />
                        </div>

                        {/* Cột phải: Tồn kho & Lịch sử */}
                        <div className="flex flex-1 flex-col gap-6 lg:min-h-0 lg:overflow-y-auto lg:border-l lg:border-[var(--color-border-soft)] lg:pl-6 lg:pr-2 lg:custom-scrollbar">
                            <div className="shrink-0">
                                <ProductStockPlacementList
                                    stockSummary={stockSummary}
                                    labels={labels}
                                />
                            </div>
                            <div className="shrink-0">
                                <ProductMovementHistoryList
                                    records={records}
                                    loading={loading}
                                    warehouses={warehouses}
                                    locations={locations}
                                    labels={labels}
                                />
                            </div>

                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
}
