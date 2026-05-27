"use client";

/**
 * CreateVoucherTab — 4-step stepper for creating import vouchers
 *
 * Steps:
 * 1. Upload chứng từ (FileUploadField)
 * 2. Thông tin chung (warehouse, supplier, PO, notes)
 * 3. Danh sách sản phẩm (add/remove items table)
 * 4. Xác nhận & Gửi (review + submit)
 *
 * Clone flow (Q1): Khi cloneData có giá trị → pre-fill steps 2-3.
 * Upload files: Lên temp path trước → move sau khi voucher created.
 *
 * LUẬT THÉP:
 * - gooeyToast.promise cho submit
 * - Disable nút khi đang gửi (chống click đúp)
 * - i18n cho tất cả text
 */

import { useState, useCallback, useEffect, useMemo } from "react";
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
import { createImportVoucher } from "../../../hooks/useImportVoucherApi";
import { uploadFile } from "../../../lib/uploadFile";
import { FileUploadField, type SelectedFile } from "../../shared/FileUploadField";
import { useWarehouses } from "../../../hooks/useWarehouses";
import { useProducts } from "../../../hooks/useProducts";
import { useWarehouseLocations } from "../../../hooks/useWarehouses";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

interface CreateVoucherTabProps {
  cloneData?: Record<string, unknown> | null;
  onCreated: () => void;
}

interface VoucherFormData {
  warehouse_id: string;
  supplier_name: string;
  purchase_order_id: string;
  notes: string;
  items: VoucherItemData[];
}

interface VoucherItemData {
  id: string;
  product_id: string;
  product_name: string;
  warehouse_location_id: string;
  expected_quantity: number;
  actual_quantity: number;
  unit_price: number;
  condition: string;
  notes: string;
}

// ─────────────────────────────────────────────
// STEP CONFIG
// ─────────────────────────────────────────────

interface StepConfig {
  id: number;
  icon: React.ElementType;
  labelKey: string;
  fallback: string;
}

const STEPS: StepConfig[] = [
  { id: 0, icon: Upload, labelKey: "upload", fallback: "Tải chứng từ" },
  { id: 1, icon: ClipboardList, labelKey: "info", fallback: "Thông tin" },
  { id: 2, icon: Package, labelKey: "items", fallback: "Sản phẩm" },
  { id: 3, icon: CheckCircle2, labelKey: "confirm", fallback: "Xác nhận" },
];


// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function CreateVoucherTab({
  cloneData,
  onCreated,
}: CreateVoucherTabProps) {
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { products, loading: productsLoading } = useProducts();
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState("");

  // ── File upload state ──
  const [files, setFiles] = useState<SelectedFile[]>([]);

  // ── Form data ──
  const [formData, setFormData] = useState<VoucherFormData>({
    warehouse_id: "",
    supplier_name: "",
    purchase_order_id: "",
    notes: "",
    items: [],
  });

  // ── Locations depend on selected warehouse (must come after formData) ──
  const { locations, loading: locationsLoading } = useWarehouseLocations(
    formData.warehouse_id || undefined,
  );

  // ── Filtered products for picker ──
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

  // ── Already-added product IDs (to prevent duplicates) ──
  const addedProductIds = useMemo(
    () => new Set(formData.items.map((i) => i.product_id)),
    [formData.items],
  );

  // ── Step labels from i18n ──
  const stepLabels = useMemo(() => {
    const steps = (t as any).importVoucher?.steps;
    return {
      upload: steps?.upload ?? "Tải chứng từ",
      info: steps?.info ?? "Thông tin",
      items: steps?.items ?? "Sản phẩm",
      confirm: steps?.confirm ?? "Xác nhận",
    };
  }, [t]);

  // ── Clone flow (pre-fill from rejected voucher) ──
  useEffect(() => {
    if (cloneData) {
      setFormData({
        warehouse_id: (cloneData.warehouse_id as string) || "",
        supplier_name: (cloneData.supplier_name as string) || "",
        purchase_order_id: (cloneData.purchase_order_id as string) || "",
        notes: (cloneData.notes as string) || "",
        items: Array.isArray(cloneData.items)
          ? (cloneData.items as VoucherItemData[]).map((item) => ({
              ...item,
              id: crypto.randomUUID(),
            }))
          : [],
      });
      // Skip to step 1 (info) since we're cloning, no new upload needed
      setStep(1);
    }
  }, [cloneData]);

  // ── Navigation ──
  const canGoNext = useCallback((): boolean => {
    switch (step) {
      case 0:
        return files.length > 0 && files.every((f) => !f.error);
      case 1:
        return formData.warehouse_id !== "" && formData.supplier_name.trim() !== "";
      case 2:
        return (
          formData.items.length > 0 &&
          formData.items.every(
            (item) =>
              item.product_id !== "" && item.expected_quantity > 0,
          )
        );
      default:
        return true;
    }
  }, [step, files, formData]);

  const handleNext = () => {
    if (step < STEPS.length - 1 && canGoNext()) setStep(step + 1);
  };
  const handlePrev = () => {
    if (step > 0) setStep(step - 1);
  };

  // ── Item management ──
  const addProductToList = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product || addedProductIds.has(productId)) return;

      const newItem: VoucherItemData = {
        id: crypto.randomUUID(),
        product_id: product.id,
        product_name: product.name,
        warehouse_location_id: "",
        expected_quantity: 1,
        actual_quantity: 0,
        unit_price: 0,
        condition: "GOOD",
        notes: "",
      };

      setFormData((d) => ({ ...d, items: [...d.items, newItem] }));
    },
    [products, addedProductIds],
  );

  const removeItem = (id: string) => {
    setFormData((d) => ({
      ...d,
      items: d.items.filter((item) => item.id !== id),
    }));
  };

  const updateItem = (id: string, field: keyof VoucherItemData, value: unknown) => {
    setFormData((d) => ({
      ...d,
      items: d.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  };

  // ── Submit ──
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
      await createImportVoucher({
        warehouse_id: formData.warehouse_id,
        supplier_name: formData.supplier_name,
        purchase_order_id: formData.purchase_order_id || undefined,
        notes: formData.notes || undefined,
        attachment_urls: uploadedUrls,
        items: formData.items.map((item) => ({
          product_id: item.product_id,
          warehouse_location_id: item.warehouse_location_id || null,
          expected_quantity: item.expected_quantity,
          actual_quantity: item.actual_quantity,
          unit_price: item.unit_price,
          condition: item.condition,
          notes: item.notes || undefined,
        })),
        action_time: new Date().toISOString(),
      });
    };

    const retryAction = () => handleSubmit();

    try {
      await gooeyToast.promise(submitAction(), {
        loading: (t as any).importVoucher?.toast?.creating ?? "Đang tạo phiếu nhập kho...",
        success: (t as any).importVoucher?.toast?.createSuccess ?? "Đã tạo phiếu nhập kho",
        error: (t as any).importVoucher?.toast?.createError ?? "Lỗi khi tạo phiếu nhập kho",
        description: {
          success:
            (t as any).importVoucher?.toast?.createSuccessDesc ??
            "Phiếu đã được gửi vào quy trình duyệt.",
          error:
            (t as any).importVoucher?.toast?.createErrorDesc ??
            "Vui lòng thử lại hoặc liên hệ quản trị viên.",
        },
        action: {
          error: {
            label: (t as any).common?.retry ?? "Thử lại",
            onClick: retryAction,
          },
        },
      });
      onCreated();
    } catch {
      // Toast already shows error
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Stepper Header ── */}
      <div className="flex items-center gap-1 overflow-x-auto py-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = step === s.id;
          const isCompleted = step > s.id;

          return (
            <div key={s.id} className="flex items-center gap-1">
              {i > 0 && (
                <div
                  className={`h-px w-6 shrink-0 transition-colors lg:w-10 ${
                    isCompleted
                      ? "bg-[var(--color-brand-primary)]"
                      : "bg-[var(--color-border-subtle)]"
                  }`}
                />
              )}
              <button
                type="button"
                onClick={() => {
                  if (isCompleted || isActive) setStep(s.id);
                }}
                disabled={!isCompleted && !isActive}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                    : isCompleted
                      ? "bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]"
                      : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]"
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">
                  {stepLabels[s.labelKey as keyof typeof stepLabels] || s.fallback}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* ── Step Content ── */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 lg:p-6">
        {/* Step 0: Upload */}
        {step === 0 && (
          <FileUploadField
            files={files}
            onFilesChange={setFiles}
            disabled={isSubmitting}
            maxFiles={5}
            label={(t as any).importVoucher?.steps?.upload ?? "Tải chứng từ đính kèm"}
            hint="PDF, DOCX, XLSX, CSV · tối đa 20MB mỗi tệp · tối đa 5 tệp"
          />
        )}

        {/* Step 1: Info */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                {(t as any).importVoucher?.form?.warehouse ?? "Kho nhận hàng"} *
              </label>
              <select
                value={formData.warehouse_id}
                onChange={(e) =>
                  setFormData({ ...formData, warehouse_id: e.target.value })
                }
                disabled={warehousesLoading}
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)] disabled:opacity-50"
              >
                <option value="">
                  {warehousesLoading
                    ? "Đang tải danh sách kho..."
                    : warehouses.length === 0
                      ? "Không có kho nào"
                      : "— Chọn kho nhận hàng —"}
                </option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                {(t as any).importVoucher?.form?.supplier ?? "Nhà cung cấp"} *
              </label>
              <input
                type="text"
                value={formData.supplier_name}
                onChange={(e) =>
                  setFormData({ ...formData, supplier_name: e.target.value })
                }
                placeholder="Tên nhà cung cấp..."
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                {(t as any).importVoucher?.form?.purchaseOrder ?? "Mã đơn hàng (PO)"}
              </label>
              <input
                type="text"
                value={formData.purchase_order_id}
                onChange={(e) =>
                  setFormData({ ...formData, purchase_order_id: e.target.value })
                }
                placeholder="Tùy chọn"
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)]"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--color-text-secondary)]">
                {(t as any).importVoucher?.form?.notes ?? "Ghi chú"}
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                rows={3}
                placeholder="Ghi chú bổ sung..."
                className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)]"
              />
            </div>
          </div>
        )}

        {/* Step 2: Items */}
        {step === 2 && (
          <div className="space-y-4">
            {/* ── Product search + picker ── */}
            <div>
              <p className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">
                {(t as any).importVoucher?.form?.selectProduct ?? "Chọn sản phẩm từ danh mục"}
              </p>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Tìm theo tên, mã SKU hoặc barcode..."
                  className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] py-2.5 pl-9 pr-3 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)]"
                />
              </div>

              {/* Product list */}
              <div className="mt-2 max-h-48 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)]">
                {productsLoading ? (
                  <div className="flex items-center justify-center py-6 text-xs text-[var(--color-text-muted)]">
                    Đang tải sản phẩm...
                  </div>
                ) : filteredProducts.length === 0 ? (
                  <div className="flex items-center justify-center py-6 text-xs text-[var(--color-text-muted)]">
                    {productSearch ? "Không tìm thấy sản phẩm" : "Chưa có sản phẩm trong hệ thống"}
                  </div>
                ) : (
                  filteredProducts.map((p) => {
                    const isAdded = addedProductIds.has(p.id);
                    return (
                      <div
                        key={p.id}
                        className={`flex items-center gap-3 border-b border-[var(--color-border-soft)] px-3 py-2 last:border-b-0 ${
                          isAdded
                            ? "bg-[var(--color-brand-primary-muted)] opacity-60"
                            : "hover:bg-[var(--color-surface-elevated)]"
                        }`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                            {p.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                            <span>SKU: {p.code}</span>
                            {p.barcode && <span>· {p.barcode}</span>}
                            <span>· {p.unit}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isAdded}
                          onClick={() => addProductToList(p.id)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-primary)] text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-90 disabled:cursor-not-allowed disabled:opacity-30"
                          title={isAdded ? "Đã thêm" : "Thêm vào danh sách"}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* ── Selected items list ── */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                  {(t as any).importVoucher?.form?.itemList ?? "Sản phẩm đã chọn"}
                  {formData.items.length > 0 && (
                    <span className="ml-1.5 text-xs text-[var(--color-text-muted)]">
                      ({formData.items.length})
                    </span>
                  )}
                </p>
              </div>

              {formData.items.length === 0 ? (
                <p className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] py-8 text-center text-sm text-[var(--color-text-muted)]">
                  Chọn sản phẩm từ danh mục ở trên để thêm vào phiếu nhập.
                </p>
              ) : (
                <div className="space-y-2">
                  {formData.items.map((item, idx) => {
                    const product = products.find((p) => p.id === item.product_id);
                    return (
                      <div
                        key={item.id}
                        className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3"
                      >
                        {/* Item header */}
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-brand-primary-muted)] text-[10px] font-semibold text-[var(--color-brand-primary)]">
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium text-[var(--color-text-primary)]">
                              {item.product_name}
                            </span>
                            <span className="text-xs text-[var(--color-text-muted)]">
                              {product?.code} · {product?.unit}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            className="flex items-center gap-1 rounded-[var(--radius-xs)] px-1.5 py-0.5 text-xs text-[var(--color-accent-error)] transition-colors hover:bg-red-50"
                          >
                            <Trash2 size={12} />
                            {(t as any).common?.delete ?? "Xóa"}
                          </button>
                        </div>

                        {/* Item fields */}
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                          <div>
                            <label className="mb-0.5 block text-[11px] text-[var(--color-text-muted)]">
                              SL dự kiến *
                            </label>
                            <input
                              type="number"
                              value={item.expected_quantity || ""}
                              onChange={(e) =>
                                updateItem(item.id, "expected_quantity", Number(e.target.value))
                              }
                              min={1}
                              className="w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[11px] text-[var(--color-text-muted)]">
                              Đơn giá
                            </label>
                            <input
                              type="number"
                              value={item.unit_price || ""}
                              onChange={(e) =>
                                updateItem(item.id, "unit_price", Number(e.target.value))
                              }
                              min={0}
                              className="w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                            />
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[11px] text-[var(--color-text-muted)]">
                              Vị trí kho
                            </label>
                            <select
                              value={item.warehouse_location_id}
                              onChange={(e) =>
                                updateItem(item.id, "warehouse_location_id", e.target.value)
                              }
                              disabled={locationsLoading || !formData.warehouse_id}
                              className="w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-2 text-xs outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50"
                            >
                              <option value="">
                                {!formData.warehouse_id
                                  ? "Chọn kho trước"
                                  : locationsLoading
                                    ? "Đang tải..."
                                    : "— Chọn vị trí —"}
                              </option>
                              {locations.map((loc) => (
                                <option key={loc.id} value={loc.id}>
                                  {loc.name} ({loc.code})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="mb-0.5 block text-[11px] text-[var(--color-text-muted)]">
                              Tình trạng
                            </label>
                            <select
                              value={item.condition}
                              onChange={(e) =>
                                updateItem(item.id, "condition", e.target.value)
                              }
                              className="w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                            >
                              <option value="GOOD">Tốt</option>
                              <option value="DAMAGED">Hư hỏng</option>
                              <option value="MISSING">Thiếu</option>
                            </select>
                          </div>
                        </div>

                        {/* Notes (optional) */}
                        <input
                          type="text"
                          placeholder="Ghi chú cho sản phẩm này..."
                          value={item.notes}
                          onChange={(e) => updateItem(item.id, "notes", e.target.value)}
                          className="mt-2 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-border-focus)]"
                        />
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
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {(t as any).importVoucher?.steps?.confirm ?? "Xác nhận thông tin"}
            </h3>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-[var(--color-border-soft)] py-2">
                <span className="text-[var(--color-text-muted)]">Kho nhận</span>
                <span className="font-medium">{warehouses.find((w) => w.id === formData.warehouse_id)?.name || formData.warehouse_id || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border-soft)] py-2">
                <span className="text-[var(--color-text-muted)]">Nhà cung cấp</span>
                <span className="font-medium">{formData.supplier_name || "—"}</span>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border-soft)] py-2">
                <span className="text-[var(--color-text-muted)]">Mã PO</span>
                <span className="font-medium">
                  {formData.purchase_order_id || "Không có"}
                </span>
              </div>
              <div className="flex justify-between border-b border-[var(--color-border-soft)] py-2">
                <span className="text-[var(--color-text-muted)]">Tệp đính kèm</span>
                <span className="font-medium">{files.length} tệp</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[var(--color-text-muted)]">Sản phẩm</span>
                <span className="font-medium">{formData.items.length} mặt hàng</span>
              </div>
            </div>

            {formData.notes && (
              <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3 text-xs text-[var(--color-text-muted)]">
                <span className="font-medium">Ghi chú:</span> {formData.notes}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Navigation Footer ── */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          disabled={step === 0}
          className="flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-4 py-2 text-xs font-medium text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-card)] disabled:opacity-30"
        >
          <ChevronLeft size={14} />
          {(t as any).importVoucher?.form?.prev ?? "Quay lại"}
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={handleNext}
            disabled={!canGoNext()}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-4 py-2 text-xs font-medium text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98] disabled:opacity-50"
          >
            {(t as any).importVoucher?.form?.next ?? "Tiếp theo"}
            <ChevronRight size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-accent-success)] px-5 py-2 text-xs font-semibold text-white transition-all hover:brightness-95 active:scale-[0.98] disabled:opacity-50"
          >
            {isSubmitting
              ? ((t as any).importVoucher?.toast?.creating ?? "Đang tạo...")
              : ((t as any).importVoucher?.form?.submit ?? "Gửi duyệt")}
          </button>
        )}
      </div>
    </div>
  );
}
