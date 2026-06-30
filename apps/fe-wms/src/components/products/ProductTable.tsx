import React, { useState } from "react";
import {
  Package,
  Search,
  Plus,
  Edit2,
  Trash2,
  Box,
  Image as ImageIcon,
} from "lucide-react";
import type { Product } from "@bduck/shared-types";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTranslation } from "@/lib/i18n";
import { PRODUCT_TABLE_TEXT } from "@/lib/i18n/componentTranslations";

interface ProductTableProps {
  products: Product[];
  loading: boolean;
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  onAddNew: () => void;
}

export function ProductTable({
  products,
  loading,
  onEdit,
  onDelete,
  onAddNew,
}: ProductTableProps) {
  const { lang } = useTranslation();
  const copy = PRODUCT_TABLE_TEXT[lang === "zh" ? "zh" : "vi"];
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode &&
        p.barcode.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.hs_code &&
        p.hs_code.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.manufacturer &&
        p.manufacturer.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.applicable_standard &&
        p.applicable_standard.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col overflow-hidden h-full">
      {/* Header Toolbar */}
      <div className="p-5 border-b border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50/50">
        <div className="relative w-full sm:w-96">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder={copy.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-[var(--color-border-subtle)] rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] focus:border-[var(--color-border-focus)] transition-all text-sm"
          />
        </div>

        <button
          onClick={onAddNew}
          className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus size={18} />
          {copy.addProduct}
        </button>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-x-auto custom-scrollbar">
        <table className="w-full text-left min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
              <th className="px-4 py-4">{copy.columns.product}</th>
              <th className="px-4 py-4">{copy.columns.skuBarcode}</th>
              <th className="px-4 py-4">{copy.columns.category}</th>
              <th className="px-4 py-4 text-center">{copy.columns.unit}</th>
              <th className="px-4 py-4 text-center">
                {copy.columns.serialTracking}
              </th>
              <th className="px-4 py-4 text-right">{copy.columns.actions}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              // Loading Skeleton State
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  <td className="px-4 py-4">
                    <Skeleton className="h-8 w-48" />
                  </td>
                  <td className="px-4 py-4">
                    <Skeleton className="h-6 w-24" />
                  </td>
                  <td className="px-4 py-4">
                    <Skeleton className="h-6 w-32" />
                  </td>
                  <td className="px-4 py-4">
                    <Skeleton className="h-6 w-12 mx-auto" />
                  </td>
                  <td className="px-4 py-4">
                    <Skeleton className="h-6 w-16 mx-auto rounded-full" />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <Skeleton className="h-8 w-16 ml-auto" />
                  </td>
                </tr>
              ))
            ) : filteredProducts.length === 0 ? (
              // Empty State
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-16 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Package size={28} className="text-gray-400" />
                    </div>
                    <p className="text-lg font-medium text-gray-900 mb-1">
                      {copy.emptyTitle}
                    </p>
                    <p className="w-full text-sm text-gray-500">
                      {searchTerm ? copy.emptySearchHint : copy.emptyHint}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-[var(--color-brand-primary-muted)] transition-colors group"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-8 rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                        {product.product_image_url &&
                        product.product_image_url.length > 0 ? (
                          <img
                            src={product.product_image_url[0]}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon size={18} className="text-gray-400" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 line-clamp-1">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500 line-clamp-1">
                          {product.description || copy.noDescription}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-medium text-[var(--color-status-approved-text)] bg-[var(--color-status-approved-bg)] px-2 py-0.5 rounded inline-block text-sm">
                      {product.code}
                    </p>
                    {product.barcode && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <span className="w-3 h-3 inline-block bg-gray-200 rounded-sm"></span>{" "}
                        {product.barcode}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <p className="text-sm text-gray-700">
                      {product.product_type}
                    </p>
                    {product.product_origin && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {product.product_origin}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                      {product.unit}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {product.is_serialized ? (
                      <span className="inline-flex px-2 py-1 bg-[var(--color-status-completed-bg-muted)] text-[var(--color-status-completed-text)] text-xs font-semibold rounded-full">
                        {copy.yes}
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                        {copy.no}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(product)}
                        className="p-1.5 text-[var(--color-status-approved-text)] hover:bg-[var(--color-status-approved-bg)] rounded-md transition-colors"
                        title={copy.edit}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              copy.confirmDelete.replace(
                                "{{name}}",
                                product.name,
                              ),
                            )
                          ) {
                            onDelete(product.id);
                          }
                        }}
                        className="p-1.5 text-[var(--color-error-icon)] hover:bg-[var(--color-error-bg)] rounded-md transition-colors"
                        title={copy.delete}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      {!loading && filteredProducts.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
          <span>
            {copy.visibleCount.replace(
              "{{count}}",
              String(filteredProducts.length),
            )}
          </span>
          {/* Implement real pagination controls here later if needed */}
        </div>
      )}
    </div>
  );
}
