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
  const [searchTerm, setSearchTerm] = useState("");

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchTerm.toLowerCase())),
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
            placeholder="Tìm kiếm theo Tên, Mã SKU hoặc Barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-sm"
          />
        </div>

        <button
          onClick={onAddNew}
          className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-2 shadow-sm"
        >
          <Plus size={18} />
          Thêm Sản phẩm
        </button>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-x-auto custom-scrollbar">
        <table className="w-full text-left min-w-[900px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
              <th className="px-6 py-4">Sản phẩm</th>
              <th className="px-6 py-4">Mã SKU / Barcode</th>
              <th className="px-6 py-4">Phân loại</th>
              <th className="px-6 py-4 text-center">ĐVT</th>
              <th className="px-6 py-4 text-center">Serial Tracking</th>
              <th className="px-6 py-4 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              // Loading Skeleton State
              Array.from({ length: 5 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`}>
                  <td className="px-6 py-4">
                    <Skeleton className="h-10 w-48" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-6 w-24" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-6 w-32" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-6 w-12 mx-auto" />
                  </td>
                  <td className="px-6 py-4">
                    <Skeleton className="h-6 w-16 mx-auto rounded-full" />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Skeleton className="h-8 w-16 ml-auto" />
                  </td>
                </tr>
              ))
            ) : filteredProducts.length === 0 ? (
              // Empty State
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-16 text-center text-gray-500"
                >
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                      <Package size={28} className="text-gray-400" />
                    </div>
                    <p className="text-lg font-medium text-gray-900 mb-1">
                      Không tìm thấy sản phẩm nào
                    </p>
                    <p className="text-sm text-gray-500 max-w-sm mx-auto">
                      {searchTerm
                        ? "Thử tìm kiếm với từ khóa khác."
                        : "Chưa có dữ liệu sản phẩm trên hệ thống. Hãy thêm mới."}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              // Data Rows
              filteredProducts.map((product) => (
                <tr
                  key={product.id}
                  className="hover:bg-blue-50/30 transition-colors group"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
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
                          {product.description || "Không có mô tả"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded inline-block text-sm">
                      {product.code}
                    </p>
                    {product.barcode && (
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                        <span className="w-3 h-3 inline-block bg-gray-200 rounded-sm"></span>{" "}
                        {product.barcode}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-gray-700">
                      {product.product_type}
                    </p>
                    {product.product_origin && (
                      <p className="text-xs text-gray-500 mt-0.5">
                        {product.product_origin}
                      </p>
                    )}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="inline-flex items-center justify-center px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                      {product.unit}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    {product.is_serialized ? (
                      <span className="inline-flex px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                        Có
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-1 bg-gray-100 text-gray-500 text-xs font-medium rounded-full">
                        Không
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onEdit(product)}
                        className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Chỉnh sửa"
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => {
                          if (
                            confirm(
                              `Bạn có chắc chắn muốn xóa sản phẩm "${product.name}"?`,
                            )
                          ) {
                            onDelete(product.id);
                          }
                        }}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Xóa"
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
        <div className="px-6 py-3 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 flex justify-between items-center">
          <span>Hiển thị {filteredProducts.length} sản phẩm</span>
          {/* Implement real pagination controls here later if needed */}
        </div>
      )}
    </div>
  );
}
