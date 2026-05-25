import React, { useState, useEffect } from "react";
import {
  X,
  Upload,
  Loader2,
  Image as ImageIcon,
  Plus,
  Trash2,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { ProductType, ProductOrigin } from "@bduck/shared-types";
import type { Product } from "@bduck/shared-types";
import { uploadImageAsWebp } from "@/lib/firebaseStorage";
import { useCategories } from "@/hooks/useCategories";
import { useProducts } from "@/hooks/useProducts";
import { useProductBOM } from "@/hooks/useProductBOM";

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  product?: Product | null; // Nếu null/undefined => Create mode, else => Edit mode
  onSave: (payload: any) => Promise<any>; // onSave gốc cho tạo Product chính
}

// Model tạm thời cho UI list BOM
interface BOMItemState {
  id: string; // Unique ID cho React key
  child_product_id: string;
  quantity: string | number;
  note: string;
}

export function ProductFormModal({
  isOpen,
  onClose,
  product,
  onSave,
}: ProductFormModalProps) {
  const isEdit = !!product;
  const { categories } = useCategories();
  // Tải toàn bộ products (để lọc ra danh sách có thể làm BOM)
  const { products: allProducts, loading: loadingAllProducts } = useProducts();
  // Lấy BOM realtime từ Backend nếu đang Edit
  const { boms: existingBOMs, updateBOM } = useProductBOM(product?.id);

  const [activeTab, setActiveTab] = useState<"info" | "bom">("info");

  const [formData, setFormData] = useState({
    category_id: "",
    name: "",
    code: "",
    barcode: "",
    unit: "Cái",
    product_type: ProductType.EQUIPMENT,
    product_material: "",
    product_origin: ProductOrigin.DOMESTIC,
    min_stock_threshold: "",
    is_serialized: false,
    description: "",
  });

  const [images, setImages] = useState<File[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // State quản lý danh sách BOM trên UI
  const [bomList, setBomList] = useState<BOMItemState[]>([]);

  useEffect(() => {
    if (product && isOpen) {
      setFormData({
        category_id: product.category_id,
        name: product.name,
        code: product.code,
        barcode: product.barcode || "",
        unit: product.unit,
        product_type: product.product_type,
        product_material: product.product_material || "",
        product_origin: product.product_origin || ProductOrigin.DOMESTIC,
        min_stock_threshold: product.min_stock_threshold
          ? String(product.min_stock_threshold)
          : "",
        is_serialized: product.is_serialized,
        description: product.description || "",
      });
      setExistingImages(product.product_image_url || []);
      setImages([]);
      setActiveTab("info");
    } else if (isOpen) {
      setFormData({
        category_id: "",
        name: "",
        code: "",
        barcode: "",
        unit: "Cái",
        product_type: ProductType.EQUIPMENT,
        product_material: "",
        product_origin: ProductOrigin.DOMESTIC,
        min_stock_threshold: "",
        is_serialized: false,
        description: "",
      });
      setImages([]);
      setExistingImages([]);
      setBomList([]);
      setActiveTab("info");
    }
  }, [product, isOpen]);

  // Đồng bộ existingBOMs từ backend vào state UI khi vừa mở edit
  useEffect(() => {
    if (isEdit && existingBOMs.length > 0) {
      const mapped = existingBOMs.map((b) => ({
        id: crypto.randomUUID(), // fake id for ui key
        child_product_id: b.child_product_id,
        quantity: b.quantity,
        note: b.note || "",
      }));
      setBomList(mapped);
    } else if (isEdit && existingBOMs.length === 0) {
      setBomList([]);
    }
  }, [existingBOMs, isEdit]);

  if (!isOpen) return null;

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selectedFiles = Array.from(e.target.files);
      const validFiles = selectedFiles.filter(
        (f) => f.size <= 20 * 1024 * 1024,
      ); // max 20MB

      if (validFiles.length < selectedFiles.length) {
        gooeyToast.error("Kích thước ảnh vượt quá 20MB", {
          description: "Một số ảnh đã bị loại bỏ vì quá dung lượng.",
        });
      }

      setImages((prev) => [...prev, ...validFiles]);
    }
  };

  const removeImage = (index: number, isExisting: boolean) => {
    if (isExisting) {
      setExistingImages((prev) => prev.filter((_, i) => i !== index));
    } else {
      setImages((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleAddBomRow = () => {
    setBomList((prev) => [
      ...prev,
      { id: crypto.randomUUID(), child_product_id: "", quantity: 1, note: "" },
    ]);
  };

  const handleRemoveBomRow = (id: string) => {
    setBomList((prev) => prev.filter((item) => item.id !== id));
  };

  const handleBomChange = (
    id: string,
    field: keyof BOMItemState,
    value: any,
  ) => {
    setBomList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const action = async () => {
      try {
        let uploadedUrls: string[] = [];

        // Nén và upload các ảnh mới
        if (images.length > 0) {
          const uploadPromises = images.map((file) =>
            uploadImageAsWebp(file, "products"),
          );
          uploadedUrls = await Promise.all(uploadPromises);
        }

        const finalImageUrls = [...existingImages, ...uploadedUrls];

        const payload = {
          ...formData,
          min_stock_threshold: formData.min_stock_threshold
            ? parseInt(formData.min_stock_threshold, 10)
            : null,
          product_image_url: finalImageUrls.length > 0 ? finalImageUrls : null,
          barcode: formData.barcode || null,
          product_material: formData.product_material || null,
        };

        // 1. Update Product Parent
        const res = await onSave(payload);

        // Lấy ID product chính sau khi lưu (nếu create) hoặc id hiện tại (nếu edit)
        const savedProductId = isEdit ? product!.id : res.data?.id;

        // 2. Lọc và chuẩn bị mảng BOM hợp lệ (bỏ qua những row chưa chọn sản phẩm con)
        if (savedProductId && (bomList.length > 0 || isEdit)) {
          const validBoms = bomList
            .filter((b) => b.child_product_id && Number(b.quantity) > 0)
            .map((b) => ({
              child_product_id: b.child_product_id,
              quantity: Number(b.quantity),
              note: b.note.trim() || null,
            }));

          // Gọi updateBOM lên server (Bulk Update)
          await updateBOM(savedProductId, { bom_items: validBoms });
        }

        onClose();
      } finally {
        setIsSubmitting(false);
      }
    };

    gooeyToast.promise(action(), {
      loading: isEdit ? "Đang lưu dữ liệu..." : "Đang tạo sản phẩm...",
      success: isEdit ? "Đã lưu thay đổi" : "Đã tạo sản phẩm thành công",
      error: "Đã xảy ra lỗi",
      description: {
        success: "Tất cả thay đổi (Sản phẩm & Định mức) đã được đồng bộ.",
        error: (error: unknown) =>
          error instanceof Error
            ? error.message
            : "Vui lòng kiểm tra lại thông tin và thử lại.",
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-[95%] max-w-4xl flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-6 py-4">
          <h2 className="text-[21px] font-semibold text-[var(--color-text-primary)]">
            {isEdit ? "Chỉnh sửa Sản phẩm" : "Thêm Sản phẩm mới"}
          </h2>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)] active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="mt-2 flex border-b border-[var(--color-border-soft)] px-6">
          <button
            onClick={() => setActiveTab("info")}
            className={`border-b-2 px-4 py-2 text-sm font-normal transition-colors ${activeTab === "info" ? "border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"}`}
          >
            Thông tin cơ bản
          </button>
          <button
            onClick={() => setActiveTab("bom")}
            className={`border-b-2 px-4 py-2 text-sm font-normal transition-colors ${activeTab === "bom" ? "border-[var(--color-brand-primary)] text-[var(--color-brand-primary)]" : "border-transparent text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"}`}
          >
            Định mức vật tư (BOM)
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar">
          <form id="productForm" onSubmit={handleSubmit} className="h-full">
            {/* TAB INFO */}
            <div
              className={`space-y-6 ${activeTab === "info" ? "block" : "hidden"}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Category */}
                <div className="col-span-2 md:col-span-1">
                  <label className="mb-1 block text-sm font-normal text-[var(--color-text-secondary)]">
                    Danh mục <span className="text-red-500">*</span>
                  </label>
                  <select
                    required={activeTab === "info"}
                    value={formData.category_id}
                    onChange={(e) =>
                      setFormData({ ...formData, category_id: e.target.value })
                    }
                    className="w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border-focus)]"
                  >
                    <option value="" disabled>
                      Chọn danh mục
                    </option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name} ({cat.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Type */}
                <div className="col-span-2 md:col-span-1">
                  <label className="mb-1 block text-sm font-normal text-[var(--color-text-secondary)]">
                    Loại hình <span className="text-red-500">*</span>
                  </label>
                  <select
                    required={activeTab === "info"}
                    value={formData.product_type}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        product_type: e.target.value as ProductType,
                      })
                    }
                    className="w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border-focus)]"
                  >
                    {Object.values(ProductType).map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Name */}
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-normal text-[var(--color-text-secondary)]">
                    Tên sản phẩm <span className="text-red-500">*</span>
                  </label>
                  <input
                    required={activeTab === "info"}
                    type="text"
                    placeholder="Nhập tên sản phẩm"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border-focus)]"
                  />
                </div>

                {/* Code */}
                <div>
                  <label className="mb-1 block text-sm font-normal text-[var(--color-text-secondary)]">
                    Mã (SKU) <span className="text-red-500">*</span>
                  </label>
                  <input
                    required={activeTab === "info"}
                    disabled={isEdit} // Immutable field
                    type="text"
                    placeholder="Ví dụ: P001"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value })
                    }
                    className="w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border-focus)] disabled:bg-[var(--color-surface-card)] disabled:text-[var(--color-text-muted)]"
                  />
                  {isEdit && (
                    <p className="text-xs text-gray-400 mt-1">
                      Mã SKU không thể chỉnh sửa
                    </p>
                  )}
                </div>

                {/* Barcode */}
                <div>
                  <label className="mb-1 block text-sm font-normal text-[var(--color-text-secondary)]">
                    Mã vạch (Barcode)
                  </label>
                  <input
                    type="text"
                    placeholder="Scan mã vạch..."
                    value={formData.barcode}
                    onChange={(e) =>
                      setFormData({ ...formData, barcode: e.target.value })
                    }
                    className="w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border-focus)]"
                  />
                </div>

                {/* Unit & Threshold */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-normal text-[var(--color-text-secondary)]">
                      Đơn vị <span className="text-red-500">*</span>
                    </label>
                    <input
                      required={activeTab === "info"}
                      type="text"
                      placeholder="PCS, BOX..."
                      value={formData.unit}
                      onChange={(e) =>
                        setFormData({ ...formData, unit: e.target.value })
                      }
                      className="w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border-focus)]"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-normal text-[var(--color-text-secondary)]">
                      Tồn tối thiểu
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      value={formData.min_stock_threshold}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          min_stock_threshold: e.target.value,
                        })
                      }
                      className="w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border-focus)]"
                    />
                  </div>
                </div>

                {/* Origin & Material */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-normal text-[var(--color-text-secondary)]">
                      Nguồn gốc
                    </label>
                    <select
                      value={formData.product_origin}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          product_origin: e.target.value as ProductOrigin,
                        })
                      }
                      className="w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border-focus)]"
                    >
                      <option value={ProductOrigin.DOMESTIC}>
                        Trong nước (DOMESTIC)
                      </option>
                      <option value={ProductOrigin.INTERNATIONAL}>
                        Quốc tế (INTERNATIONAL)
                      </option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-normal text-[var(--color-text-secondary)]">
                      Chất liệu
                    </label>
                    <input
                      type="text"
                      placeholder="Nhựa, Kim loại..."
                      value={formData.product_material}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          product_material: e.target.value,
                        })
                      }
                      className="w-full rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border-focus)]"
                    />
                  </div>
                </div>

                {/* Serialized tracking */}
                <div className="col-span-2 flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--color-brand-primary)]/25 bg-[var(--color-brand-primary-muted)] p-4 text-[var(--color-text-secondary)]">
                  <input
                    id="is_serialized"
                    type="checkbox"
                    disabled={isEdit} // Immutable field
                    checked={formData.is_serialized}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_serialized: e.target.checked,
                      })
                    }
                    className="h-5 w-5 cursor-pointer rounded border-[var(--color-border-subtle)] text-[var(--color-brand-primary)] focus:ring-[var(--color-border-focus)] disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="is_serialized"
                      className={`font-medium ${isEdit ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                    >
                      Theo dõi số Serial (Serialized Tracking)
                    </label>
                    <p className="text-sm opacity-80 mt-0.5">
                      Bật tùy chọn này nếu mỗi đơn vị của sản phẩm cần một mã
                      Serial riêng biệt. (Lưu ý: Không thể thay đổi sau khi
                      tạo).
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="col-span-2">
                  <label className="mb-1 block text-sm font-normal text-[var(--color-text-secondary)]">
                    Mô tả thêm
                  </label>
                  <textarea
                    rows={3}
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-4 py-2 text-sm outline-none transition-all focus:border-[var(--color-border-focus)]"
                  />
                </div>

                {/* Images */}
                <div className="col-span-2">
                  <label className="mb-2 block text-sm font-normal text-[var(--color-text-secondary)]">
                    Hình ảnh sản phẩm (Nén tự động WEBP)
                  </label>

                  <div className="flex flex-wrap gap-4 mb-4">
                    {existingImages.map((url, i) => (
                      <div
                        key={`existing-${i}`}
                        className="relative group w-24 h-24 rounded-lg overflow-hidden border border-gray-200"
                      >
                        <img
                          src={url}
                          alt={`Preview ${i}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(i, true)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}

                    {images.map((file, i) => (
                      <div
                        key={`new-${i}`}
                        className="relative group w-24 h-24 rounded-lg overflow-hidden border border-gray-200"
                      >
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`New ${i}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(i, false)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}

                    <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--color-border-subtle)] transition-colors hover:border-[var(--color-brand-primary)] hover:bg-[var(--color-surface-card)]">
                      <Upload size={24} className="mb-2 text-[var(--color-text-muted)]" />
                      <span className="text-xs font-normal text-[var(--color-text-muted)]">
                        Tải ảnh
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={handleImageChange}
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            {/* TAB BOM */}
            <div
              className={`space-y-4 ${activeTab === "bom" ? "block" : "hidden"}`}
            >
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="font-semibold text-[var(--color-text-primary)]">
                    Danh sách Phụ tùng / Vật tư
                  </h3>
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Khai báo những thành phần cần thiết để lắp ráp thành sản
                    phẩm này.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddBomRow}
                  className="flex items-center gap-2 rounded-full border border-[var(--color-brand-primary)] px-3 py-1.5 text-sm font-normal text-[var(--color-brand-primary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95"
                >
                  <Plus size={16} /> Thêm vật tư
                </button>
              </div>

              {loadingAllProducts ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-[var(--color-text-muted)]">
                  <Loader2 className="animate-spin mb-2" size={24} />
                  Đang tải danh sách sản phẩm...
                </div>
              ) : bomList.length === 0 ? (
                <div className="rounded-[var(--radius-lg)] border-2 border-dashed border-[var(--color-border-subtle)] py-12 text-center">
                  <p className="mb-3 text-sm text-[var(--color-text-muted)]">
                    Sản phẩm này chưa có định mức vật tư nào.
                  </p>
                  <button
                    type="button"
                    onClick={handleAddBomRow}
                    className="text-sm font-normal text-[var(--color-brand-primary)] hover:underline"
                  >
                    + Thêm định mức đầu tiên
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-12 gap-3 border-b border-[var(--color-border-soft)] px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    <div className="col-span-5">Phụ tùng (Mã SKU)</div>
                    <div className="col-span-2">Số lượng</div>
                    <div className="col-span-4">Ghi chú lắp ráp</div>
                    <div className="col-span-1 text-right">Xóa</div>
                  </div>

                  {bomList.map((item, index) => (
                    <div
                      key={item.id}
                      className="grid grid-cols-12 gap-3 items-start group"
                    >
                      <div className="col-span-5">
                        <select
                          value={item.child_product_id}
                          onChange={(e) =>
                            handleBomChange(
                              item.id,
                              "child_product_id",
                              e.target.value,
                            )
                          }
                          className="w-full rounded-full border border-[var(--color-border-subtle)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                          required={activeTab === "bom"}
                        >
                          <option value="" disabled>
                            -- Chọn sản phẩm phụ tùng --
                          </option>
                          {allProducts.map((p) => {
                            // Không cho phép chọn chính mình làm BOM của mình
                            if (p.id === product?.id) return null;
                            return (
                              <option key={p.id} value={p.id}>
                                {p.name} ({p.code})
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) =>
                            handleBomChange(item.id, "quantity", e.target.value)
                          }
                          placeholder="SL"
                          required={activeTab === "bom"}
                          className="w-full rounded-full border border-[var(--color-border-subtle)] px-3 py-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                        />
                      </div>
                      <div className="col-span-4">
                        <input
                          type="text"
                          value={item.note}
                          onChange={(e) =>
                            handleBomChange(item.id, "note", e.target.value)
                          }
                          placeholder="Ghi chú (tuỳ chọn)"
                          className="w-full rounded-full border border-[var(--color-border-subtle)] px-3 py-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                        />
                      </div>
                      <div className="col-span-1 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveBomRow(item.id)}
                          className="mt-0.5 rounded-full p-2 text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-surface-card)] hover:text-[var(--color-accent-error)] active:scale-95"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--color-border-soft)] bg-[var(--color-surface-card)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-full border border-[var(--color-border-subtle)] bg-white px-4 py-2 font-normal text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-card)] active:scale-95 disabled:opacity-50"
          >
            Hủy
          </button>
          <button
            type="submit"
            form="productForm"
            disabled={isSubmitting}
            className="flex items-center gap-2 rounded-full bg-[var(--color-brand-primary)] px-6 py-2 font-normal text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-95 disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin" /> Đang lưu...
              </>
            ) : isEdit ? (
              "Lưu thay đổi"
            ) : (
              "Hoàn tất"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
