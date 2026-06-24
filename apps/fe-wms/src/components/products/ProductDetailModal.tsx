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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            onClick={onClose}
            aria-label={labels.title}
        >
            <div className="flex max-h-[92vh] w-[min(96vw,1120px)] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] shadow-xl">

                <div className="flex min-h-0 flex-1 overflow-hidden p-4">
                    <div className="grid h-full w-full grid-cols-1 gap-6 lg:grid-cols-[0.8fr_1.2fr]">

                        {/* Cột trái: Ảnh & Thông tin */}
                        <div className="flex h-full flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
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
                        <div className="flex h-full flex-col gap-6 overflow-y-auto pl-2 pr-2 custom-scrollbar lg:border-l lg:border-[var(--color-border-soft)] lg:pl-6">
                            <ProductStockPlacementList
                                stockSummary={stockSummary}
                                labels={labels}
                            />
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
    );
}
