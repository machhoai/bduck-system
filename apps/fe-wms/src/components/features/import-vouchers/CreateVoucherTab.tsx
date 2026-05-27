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
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import { createImportVoucher } from "../../../hooks/useImportVoucherApi";
import { uploadFile } from "../../../lib/uploadFile";
import { FileUploadField, type SelectedFile } from "../../shared/FileUploadField";

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
// EMPTY ITEM FACTORY
// ─────────────────────────────────────────────

function createEmptyItem(): VoucherItemData {
  return {
    id: crypto.randomUUID(),
    product_id: "",
    product_name: "",
    warehouse_location_id: "",
    expected_quantity: 0,
    actual_quantity: 0,
    unit_price: 0,
    condition: "NEW",
    notes: "",
  };
}

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function CreateVoucherTab({
  cloneData,
  onCreated,
}: CreateVoucherTabProps) {
  const { t } = useTranslation();
  const user = useUserStore((s) => s.user);
  const [step, setStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── File upload state ──
  const [files, setFiles] = useState<SelectedFile[]>([]);

  // ── Form data ──
  const [formData, setFormData] = useState<VoucherFormData>({
    warehouse_id: "",
    supplier_name: "",
    purchase_order_id: "",
    notes: "",
    items: [createEmptyItem()],
  });

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
          : [createEmptyItem()],
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
  const addItem = () => {
    setFormData((d) => ({ ...d, items: [...d.items, createEmptyItem()] }));
  };

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
        items: formData.items.map((item) => ({
          product_id: item.product_id,
          warehouse_location_id: item.warehouse_location_id,
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

    gooeyToast.promise(submitAction(), {
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

    try {
      await submitAction();
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
              <input
                type="text"
                value={formData.warehouse_id}
                onChange={(e) =>
                  setFormData({ ...formData, warehouse_id: e.target.value })
                }
                placeholder="Chọn kho nhận hàng..."
                className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-2.5 text-sm text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)]"
              />
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
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                {(t as any).importVoucher?.form?.itemList ?? "Danh sách sản phẩm"}
              </p>
              <button
                type="button"
                onClick={addItem}
                className="rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98]"
              >
                + {(t as any).importVoucher?.form?.addItem ?? "Thêm sản phẩm"}
              </button>
            </div>

            {formData.items.length === 0 && (
              <p className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                Chưa có sản phẩm. Nhấn "Thêm sản phẩm" để bắt đầu.
              </p>
            )}

            <div className="space-y-2">
              {formData.items.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-medium text-[var(--color-text-muted)]">
                      #{idx + 1}
                    </span>
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        className="text-xs text-[var(--color-accent-error)] hover:underline"
                      >
                        {(t as any).common?.delete ?? "Xóa"}
                      </button>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    <input
                      type="text"
                      placeholder="Mã sản phẩm *"
                      value={item.product_id}
                      onChange={(e) =>
                        updateItem(item.id, "product_id", e.target.value)
                      }
                      className="rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                    />
                    <input
                      type="text"
                      placeholder="Vị trí kho"
                      value={item.warehouse_location_id}
                      onChange={(e) =>
                        updateItem(item.id, "warehouse_location_id", e.target.value)
                      }
                      className="rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                    />
                    <input
                      type="number"
                      placeholder="SL dự kiến *"
                      value={item.expected_quantity || ""}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "expected_quantity",
                          Number(e.target.value),
                        )
                      }
                      min={0}
                      className="rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                    />
                    <input
                      type="number"
                      placeholder="Đơn giá"
                      value={item.unit_price || ""}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "unit_price",
                          Number(e.target.value),
                        )
                      }
                      min={0}
                      className="rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                    />
                    <select
                      value={item.condition}
                      onChange={(e) =>
                        updateItem(item.id, "condition", e.target.value)
                      }
                      className="rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                    >
                      <option value="NEW">Mới</option>
                      <option value="USED">Đã qua sử dụng</option>
                      <option value="DAMAGED">Hư hỏng</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Ghi chú"
                      value={item.notes}
                      onChange={(e) =>
                        updateItem(item.id, "notes", e.target.value)
                      }
                      className="rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2.5 py-2 text-xs outline-none focus:border-[var(--color-border-focus)]"
                    />
                  </div>
                </div>
              ))}
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
                <span className="font-medium">{formData.warehouse_id || "—"}</span>
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
