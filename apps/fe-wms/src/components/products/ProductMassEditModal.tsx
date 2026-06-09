import React, { useState } from "react";
import { X } from "lucide-react";
import { ProductExcelMassEditTab } from "./ProductExcelMassEditTab";
import type { ProductMassEditPayload } from "@/utils/productExcelMassEdit";
import { useProducts } from "@/hooks/useProducts";
import { useCategories } from "@/hooks/useCategories";

interface ProductMassEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProductMassEditModal({
  isOpen,
  onClose,
}: ProductMassEditModalProps) {
  const { products: allProducts, updateProduct } = useProducts();
  const { categories } = useCategories();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleMassUpdateProducts = async (payloads: ProductMassEditPayload[]) => {
    setIsSubmitting(true);
    let updatedCount = 0;

    try {
      for (const payload of payloads) {
        await updateProduct(payload.id, payload);
        updatedCount += 1;
      }

      return updatedCount;
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `Đã cập nhật ${updatedCount}/${payloads.length} sản phẩm. ${error.message}`
          : `Đã cập nhật ${updatedCount}/${payloads.length} sản phẩm trước khi xảy ra lỗi.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-[95%] max-w-[90%] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-4">
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            Chỉnh sửa sản phẩm hàng loạt
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)] active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 custom-scrollbar">
          <ProductExcelMassEditTab
            products={allProducts}
            categories={categories}
            disabled={isSubmitting}
            onUpdate={handleMassUpdateProducts}
            onUpdated={onClose}
          />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-4 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-[var(--color-border-subtle)] bg-white px-4 py-2 font-normal text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95 disabled:opacity-50"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
}
