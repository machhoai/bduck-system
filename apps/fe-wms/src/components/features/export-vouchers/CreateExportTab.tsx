"use client";

/**
 * CreateExportTab — 4-step stepper for creating export vouchers
 *
 * Steps:
 * 0. Upload chứng từ (FileUploadField)
 * 1. Thông tin chung (warehouse, export type, recipient)
 * 2. Danh sách sản phẩm (pick products + quantities)
 * 3. Xác nhận & Gửi
 *
 * LUẬT THÉP:
 * - gooeyToast.promise cho submit
 * - Disable nút khi đang gửi (chống click đúp)
 * - i18n cho tất cả text
 */

import { useState, useCallback, useMemo } from "react";
import {
  Upload,
  ClipboardList,
  Package,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Search,
  Plus,
  Trash2,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import { createExportVoucher } from "../../../hooks/useExportVoucherApi";
import { useWarehouses } from "../../../hooks/useWarehouses";
import { useProducts } from "../../../hooks/useProducts";
import { uploadFile } from "../../../lib/uploadFile";
import { FileUploadField, type SelectedFile } from "../../shared/FileUploadField";
import { useWarehouseLocations } from "../../../hooks/useWarehouses";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface Props {
  onCreated: () => void;
}

interface ExportItemData {
  id: string;
  product_id: string;
  product_name: string;
  warehouse_location_id: string;
  quantity: number;
  unit_price: number;
  notes: string;
}

const EXPORT_TYPES = [
  { value: "INTERNAL", vi: "Nội bộ", zh: "内部" },
  { value: "GIFT_MANUAL", vi: "Quà tặng", zh: "礼品" },
  { value: "ADJUSTMENT", vi: "Điều chỉnh", zh: "调整" },
  { value: "TRANSFER", vi: "Điều chuyển", zh: "调拨" },
];

const STEPS = [
  { id: 0, icon: Upload, label: "Tải chứng từ" },
  { id: 1, icon: ClipboardList, label: "Thông tin" },
  { id: 2, icon: Package, label: "Sản phẩm" },
  { id: 3, icon: CheckCircle2, label: "Xác nhận" },
];

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function CreateExportTab({ onCreated }: Props) {
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { products, loading: productsLoading } = useProducts();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  // ── File upload state (copied from import) ──
  const [files, setFiles] = useState<SelectedFile[]>([]);

  // Form state
  const [warehouseId, setWarehouseId] = useState("");
  const [exportType, setExportType] = useState("INTERNAL");
  const [recipientName, setRecipientName] = useState("");
  const [recipientDept, setRecipientDept] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<ExportItemData[]>([]);

  const { locations, loading: locationsLoading } = useWarehouseLocations(
    warehouseId || undefined,
  );

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.barcode && p.barcode.toLowerCase().includes(q)),
    );
  }, [products, productSearch]);

  const addedProductIds = useMemo(
    () => new Set(items.map((i) => i.product_id)),
    [items],
  );

  // Navigation
  const canGoNext = useCallback((): boolean => {
    switch (step) {
      case 0:
        return files.length > 0 && files.every((f) => !f.error);
      case 1:
        return warehouseId !== "" && exportType !== "";
      case 2:
        return (
          items.length > 0 &&
          items.every(
            (item) => item.product_id !== "" && item.quantity > 0 && item.warehouse_location_id !== "",
          )
        );
      default:
        return true;
    }
  }, [step, files, warehouseId, exportType, items]);

  const addProduct = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product || addedProductIds.has(productId)) return;
      setItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          product_id: product.id,
          product_name: product.name,
          warehouse_location_id: "",
          quantity: 1,
          unit_price: 0,
          notes: "",
        },
      ]);
    },
    [products, addedProductIds],
  );

  const updateItem = (id: string, field: keyof ExportItemData, value: unknown) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
    );
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  // Submit
  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const submitAction = async () => {
      // 1. Upload files to temp path
      const uploadedUrls: string[] = [];
      for (const f of files) {
        if (f.url) {
          uploadedUrls.push(f.url);
          continue;
        }
        const url = await uploadFile(
          f.file,
          `temp-uploads/${user?.id || "unknown"}`,
          (percent) => {
            setFiles((prev) =>
              prev.map((pf) => (pf.id === f.id ? { ...pf, progress: percent } : pf)),
            );
          },
        );
        uploadedUrls.push(url);
      }

      // 2. Create voucher via API
      await createExportVoucher({
        warehouse_id: warehouseId,
        export_type: exportType,
        recipient_name: recipientName || undefined,
        recipient_department: recipientDept || undefined,
        notes: notes || undefined,
        attachment_urls: uploadedUrls,
        items: items.map((item) => ({
          product_id: item.product_id,
          warehouse_location_id: item.warehouse_location_id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          notes: item.notes || undefined,
        })),
        action_time: new Date().toISOString(),
      });
    };

    try {
      await gooeyToast.promise(submitAction(), {
        loading: "Đang tạo phiếu xuất kho...",
        success: "Đã tạo phiếu xuất kho",
        error: "Lỗi khi tạo phiếu xuất kho",
        description: {
          success: "Phiếu đã được gửi vào quy trình duyệt.",
          error: "Vui lòng thử lại hoặc liên hệ quản trị viên.",
        },
        action: {
          error: { label: "Thử lại", onClick: () => handleSubmit() },
        },
      });
      onCreated();
    } catch {
      // Toast handles error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isCompleted = step > s.id;
          return (
            <div key={s.id} className="flex items-center gap-1">
              {i > 0 && (
                <div className={`h-px w-6 shrink-0 lg:w-10 ${isCompleted ? "bg-orange-500" : "bg-gray-200"}`} />
              )}
              <button
                type="button"
                onClick={() => { if (isCompleted || isActive) setStep(s.id); }}
                disabled={!isCompleted && !isActive}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive ? "bg-orange-500 text-white shadow-sm"
                    : isCompleted ? "bg-orange-100 text-orange-600"
                      : "bg-gray-100 text-gray-400"
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="rounded-xl border border-gray-100 bg-white p-4 lg:p-6">
        {/* Step 0: Upload chứng từ */}
        {step === 0 && (
          <FileUploadField
            files={files}
            onFilesChange={setFiles}
            disabled={isSubmitting}
            maxFiles={5}
            label="Tải chứng từ xuất kho đính kèm"
            hint="PDF, DOCX, XLSX, CSV · tối đa 20MB mỗi tệp · tối đa 5 tệp"
          />
        )}

        {/* Step 1: Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">Kho xuất *</label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                disabled={warehousesLoading}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
              >
                <option value="">{warehousesLoading ? "Đang tải..." : "— Chọn kho xuất —"}</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>{wh.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">Loại xuất *</label>
              <select
                value={exportType}
                onChange={(e) => setExportType(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              >
                {EXPORT_TYPES.map((et) => (
                  <option key={et.value} value={et.value}>{et.vi}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-600">Người nhận</label>
                <input
                  type="text" value={recipientName} onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="Tên người nhận hàng..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-600">Bộ phận</label>
                <input
                  type="text" value={recipientDept} onChange={(e) => setRecipientDept(e.target.value)}
                  placeholder="Phòng ban / bộ phận..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-600">Ghi chú</label>
              <textarea
                value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
                placeholder="Ghi chú bổ sung..."
                className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>
          </div>
        )}

        {/* Step 2: Products — same picker pattern as import */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)}
                placeholder="Tìm sản phẩm theo tên, SKU hoặc barcode..."
                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
              />
            </div>

            {/* Product list */}
            <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
              {productsLoading ? (
                <div className="flex items-center justify-center py-6 text-xs text-gray-400">Đang tải...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex items-center justify-center py-6 text-xs text-gray-400">Không tìm thấy</div>
              ) : (
                filteredProducts.map((p) => {
                  const isAdded = addedProductIds.has(p.id);
                  return (
                    <div key={p.id} className={`flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 ${isAdded ? "bg-orange-50 opacity-60" : "hover:bg-white"}`}>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-900">{p.name}</p>
                        <div className="flex gap-2 text-xs text-gray-500">
                          <span>SKU: {p.code}</span>
                          <span>· {p.unit}</span>
                        </div>
                      </div>
                      <button type="button" disabled={isAdded} onClick={() => addProduct(p.id)}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-500 text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Selected items */}
            <div>
              <p className="mb-2 text-sm font-medium text-gray-600">
                Sản phẩm xuất kho {items.length > 0 && <span className="text-xs text-gray-400">({items.length})</span>}
              </p>
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-gray-200 py-8 text-center text-sm text-gray-400">
                  Chọn sản phẩm để thêm vào phiếu xuất.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item, idx) => {
                    const product = products.find((p) => p.id === item.product_id);
                    return (
                      <div key={item.id} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-[10px] font-semibold text-orange-600">{idx + 1}</span>
                            <span className="text-sm font-medium text-gray-900">{item.product_name}</span>
                            <span className="text-xs text-gray-400">{product?.code} · {product?.unit}</span>
                          </div>
                          <button type="button" onClick={() => removeItem(item.id)} className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50">
                            <Trash2 size={12} /> Xóa
                          </button>
                        </div>
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div>
                            <label className="mb-0.5 block text-[11px] text-gray-400">SL xuất *</label>
                            <input type="number" value={item.quantity || ""} onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))} min={1}
                              className="w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-orange-400"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[11px] text-gray-400">Đơn giá</label>
                            <input type="number" value={item.unit_price || ""} onChange={(e) => updateItem(item.id, "unit_price", Number(e.target.value))} min={0}
                              className="w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-orange-400"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[11px] text-gray-400">Vị trí kho *</label>
                            <select value={item.warehouse_location_id} onChange={(e) => updateItem(item.id, "warehouse_location_id", e.target.value)}
                              disabled={locationsLoading || !warehouseId}
                              className="w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-orange-400 disabled:opacity-50"
                            >
                              <option value="">{!warehouseId ? "Chọn kho trước" : locationsLoading ? "Đang tải..." : "— Vị trí —"}</option>
                              {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>{loc.name} ({loc.code})</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Confirm */}
        {step === 3 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Xác nhận thông tin xuất kho</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">Kho xuất</span>
                <span className="font-medium">{warehouses.find((w) => w.id === warehouseId)?.name || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">Loại xuất</span>
                <span className="font-medium">{EXPORT_TYPES.find((e) => e.value === exportType)?.vi || exportType}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">Người nhận</span>
                <span className="font-medium">{recipientName || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-gray-100 py-2">
                <span className="text-gray-500">Tệp đính kèm</span>
                <span className="font-medium">{files.length} tệp</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-gray-500">Sản phẩm</span>
                <span className="font-medium">{items.length} mặt hàng</span>
              </div>
            </div>
            {notes && (
              <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                <span className="font-medium">Ghi chú:</span> {notes}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => step > 0 && setStep(step - 1)} disabled={step === 0}
          className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50 disabled:opacity-30"
        >
          <ChevronLeft size={14} /> Quay lại
        </button>

        {step < STEPS.length - 1 ? (
          <button type="button" onClick={() => canGoNext() && setStep(step + 1)} disabled={!canGoNext()}
            className="flex items-center gap-1.5 rounded-lg bg-orange-500 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-orange-600 disabled:opacity-50"
          >
            Tiếp theo <ChevronRight size={14} />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-600 disabled:opacity-50"
          >
            {isSubmitting ? "Đang tạo..." : "Gửi duyệt"}
          </button>
        )}
      </div>
    </div>
  );
}
