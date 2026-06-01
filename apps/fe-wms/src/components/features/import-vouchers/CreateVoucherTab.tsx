"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Package,
  Plus,
  Search,
  Trash2,
  Upload,
  Warehouse,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type { Product } from "@bduck/shared-types";
import { createImportVoucher } from "../../../hooks/useImportVoucherApi";
import { useProducts } from "../../../hooks/useProducts";
import {
  useWarehouseLocations,
  useWarehouses,
} from "../../../hooks/useWarehouses";
import { uploadFile } from "../../../lib/uploadFile";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import {
  FileUploadField,
  type SelectedFile,
} from "../../shared/FileUploadField";
import { WarehouseSelectionPanel } from "./WarehouseSelectionPanel";
import { useInventoryByWarehouse } from "../../../hooks/useInventoryByWarehouse";

type Locale = "vi" | "zh";

interface CreateVoucherTabProps {
  cloneData?: Record<string, unknown> | null;
  prefillWarehouseId?: string;
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

type StepId = 0 | 1 | 2 | 3;

const COPY = {
  vi: {
    uploadHint: "PDF, DOCX, XLSX, CSV - tối đa 20MB mỗi tệp - tối đa 5 tệp",
    supplierPlaceholder: "Nhập tên nhà cung cấp",
    poPlaceholder: "Tuỳ chọn, dùng để đối chiếu đơn mua",
    notesPlaceholder:
      "Ghi chú ca nhập, điều kiện giao hàng, yêu cầu kiểm đếm...",
    searchProduct: "Tìm theo tên, SKU hoặc barcode",
    chooseFromCatalog: "Chọn sản phẩm từ danh mục",
    selectedItems: "Danh sách nhập kho",
    emptyItems: "Chọn sản phẩm từ danh mục để thêm vào phiếu nhập.",
    noProducts: "Không tìm thấy sản phẩm phù hợp.",
    loadingProducts: "Đang tải sản phẩm...",
    addProduct: "Thêm vào phiếu",
    added: "Đã thêm",
    expectedQty: "SL dự kiến",
    unitPrice: "Đơn giá",
    location: "Vị trí kho",
    condition: "Tình trạng",
    good: "Tốt",
    damaged: "Hư hỏng",
    missing: "Thiếu",
    itemNote: "Ghi chú cho sản phẩm này",
    summary: "Tóm tắt phiếu nhập",
    attachments: "Tệp đính kèm",
    products: "Mặt hàng",
    totalQty: "Tổng số lượng",
    totalValue: "Tổng giá trị",
    noWarehouse: "Chưa chọn kho",
    noPo: "Không có",
    noNotes: "Không có ghi chú",
    selectLocation: "Chọn vị trí",
    selectWarehouseFirst: "Chọn kho trước",
    loadingLocations: "Đang tải vị trí...",
    noLocations: "Kho chưa có vị trí",
  },
  zh: {
    uploadHint: "PDF、DOCX、XLSX、CSV - 每个文件最多 20MB - 最多 5 个文件",
    supplierPlaceholder: "输入供应商名称",
    poPlaceholder: "可选，用于采购单对账",
    notesPlaceholder: "入库班次备注、交货条件、清点要求...",
    searchProduct: "按名称、SKU 或条码搜索",
    chooseFromCatalog: "从目录选择产品",
    selectedItems: "入库清单",
    emptyItems: "请从目录中选择产品加入入库单。",
    noProducts: "未找到匹配产品。",
    loadingProducts: "正在加载产品...",
    addProduct: "加入单据",
    added: "已添加",
    expectedQty: "预计数量",
    unitPrice: "单价",
    location: "库位",
    condition: "状态",
    good: "良好",
    damaged: "损坏",
    missing: "缺少",
    itemNote: "此产品备注",
    summary: "入库单摘要",
    attachments: "附件",
    products: "商品",
    totalQty: "总数量",
    totalValue: "总价值",
    noWarehouse: "未选择仓库",
    noPo: "无",
    noNotes: "无备注",
    selectLocation: "选择库位",
    selectWarehouseFirst: "请先选择仓库",
    loadingLocations: "正在加载库位...",
    noLocations: "此仓库暂无库位",
  },
} as const;

const STEPS = [
  { id: 0 as StepId, icon: Warehouse, key: "info", fallback: "Thông tin" },
  { id: 1 as StepId, icon: Upload, key: "upload", fallback: "Tải chứng từ" },
  { id: 2 as StepId, icon: Package, key: "items", fallback: "Sản phẩm" },
  { id: 3 as StepId, icon: CheckCircle2, key: "confirm", fallback: "Xác nhận" },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value);
}

function ProductPickerCard({
  product,
  isAdded,
  onAdd,
  locale,
}: {
  product: Product;
  isAdded: boolean;
  onAdd: () => void;
  locale: Locale;
}) {
  const copy = COPY[locale];

  return (
    <div
      className={`rounded-[var(--radius-sm)] border p-3 transition-all ${
        isAdded
          ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
          : "border-[var(--color-border-subtle)] bg-white hover:border-[var(--color-border-focus)]"
      }`}
    >
      <div className="flex gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-surface-card)] text-[var(--color-brand-primary)]">
          <Package size={20} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text-primary)]">
            {product.name}
          </p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            SKU: {product.code} · {product.unit}
          </p>
          {product.barcode && (
            <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">
              {product.barcode}
            </p>
          )}
        </div>
      </div>
      <button
        type="button"
        disabled={isAdded}
        onClick={onAdd}
        className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-[var(--radius-xs)] bg-[var(--color-brand-primary)] text-sm font-semibold text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98] disabled:bg-[var(--color-surface-card)] disabled:text-[var(--color-text-muted)]"
      >
        {isAdded ? <CheckCircle2 size={16} /> : <Plus size={16} />}
        {isAdded ? copy.added : copy.addProduct}
      </button>
    </div>
  );
}

export default function CreateVoucherTab({
  cloneData,
  prefillWarehouseId,
  onCreated,
}: CreateVoucherTabProps) {
  const { t, lang } = useTranslation();
  const locale = (lang || "vi") as Locale;
  const copy = COPY[locale];
  const user = useUserStore((state) => state.user);
  const { warehouses, loading: warehousesLoading } = useWarehouses();
  const { locations: allLocations } = useWarehouseLocations();
  const { products, loading: productsLoading } = useProducts();
  const [step, setStep] = useState<StepId>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [formData, setFormData] = useState<VoucherFormData>({
    warehouse_id: prefillWarehouseId || "",
    supplier_name: "",
    purchase_order_id: "",
    notes: "",
    items: [],
  });

  // Auto-prefill warehouse from URL
  useEffect(() => {
    if (prefillWarehouseId) {
      setFormData((prev) => ({ ...prev, warehouse_id: prefillWarehouseId }));
    }
  }, [prefillWarehouseId]);

  const { locations, loading: locationsLoading } = useWarehouseLocations(
    formData.warehouse_id || undefined,
  );
  const { getAllLocationsForProduct, getAtp, loading: inventoryLoading } =
    useInventoryByWarehouse(formData.warehouse_id || undefined);

  const selectedWarehouse = warehouses.find(
    (warehouse) => warehouse.id === formData.warehouse_id,
  );

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const query = productSearch.toLowerCase();
    return products.filter(
      (product) =>
        product.name.toLowerCase().includes(query) ||
        product.code.toLowerCase().includes(query) ||
        (product.barcode && product.barcode.toLowerCase().includes(query)),
    );
  }, [products, productSearch]);

  const addedProductIds = useMemo(
    () => new Set(formData.items.map((item) => item.product_id)),
    [formData.items],
  );

  const stepLabels = useMemo(() => {
    const labels = (t as any).importVoucher?.steps;
    return {
      upload: labels?.upload ?? "Tải chứng từ",
      info: labels?.info ?? "Thông tin",
      items: labels?.items ?? "Sản phẩm",
      confirm: labels?.confirm ?? "Xác nhận",
    };
  }, [t]);

  const totalQuantity = useMemo(
    () =>
      formData.items.reduce(
        (total, item) => total + Number(item.expected_quantity || 0),
        0,
      ),
    [formData.items],
  );

  const totalValue = useMemo(
    () =>
      formData.items.reduce(
        (total, item) =>
          total +
          Number(item.expected_quantity || 0) * Number(item.unit_price || 0),
        0,
      ),
    [formData.items],
  );

  useEffect(() => {
    if (!cloneData) return;

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
    setStep(1);
  }, [cloneData]);

  const canGoNext = useCallback(() => {
    switch (step) {
      case 0:
        return !!formData.warehouse_id && !!formData.supplier_name.trim();
      case 1:
        return true; // Upload is optional
      case 2:
        return (
          formData.items.length > 0 &&
          formData.items.every(
            (item) =>
              item.product_id &&
              item.expected_quantity > 0 &&
              item.warehouse_location_id,
          )
        );
      default:
        return true;
    }
  }, [files, formData, step]);

  const addProductToList = useCallback(
    (productId: string) => {
      const product = products.find((item) => item.id === productId);
      if (!product || addedProductIds.has(productId)) return;

      setFormData((current) => ({
        ...current,
        items: [
          ...current.items,
          {
            id: crypto.randomUUID(),
            product_id: product.id,
            product_name: product.name,
            warehouse_location_id: "",
            expected_quantity: 1,
            actual_quantity: 0,
            unit_price: 0,
            condition: "GOOD",
            notes: "",
          },
        ],
      }));
    },
    [addedProductIds, products],
  );

  const removeItem = (id: string) => {
    setFormData((current) => ({
      ...current,
      items: current.items.filter((item) => item.id !== id),
    }));
  };

  const updateItem = (
    id: string,
    field: keyof VoucherItemData,
    value: unknown,
  ) => {
    setFormData((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const submitAction = async () => {
      const uploadedUrls: string[] = [];
      for (const selectedFile of files) {
        if (selectedFile.url) {
          uploadedUrls.push(selectedFile.url);
          continue;
        }

        const url = await uploadFile(
          selectedFile.file,
          `temp-uploads/${user?.id || "unknown"}`,
          (percent) => {
            setFiles((current) =>
              current.map((file) =>
                file.id === selectedFile.id
                  ? { ...file, progress: percent }
                  : file,
              ),
            );
          },
        );
        uploadedUrls.push(url);
      }

      await createImportVoucher({
        warehouse_id: formData.warehouse_id,
        supplier_name: formData.supplier_name,
        purchase_order_id: formData.purchase_order_id || undefined,
        notes: formData.notes || undefined,
        attachment_urls: uploadedUrls,
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

    try {
      await gooeyToast.promise(submitAction(), {
        loading:
          (t as any).importVoucher?.toast?.creating ??
          "Đang tạo phiếu nhập kho...",
        success:
          (t as any).importVoucher?.toast?.createSuccess ??
          "Đã tạo phiếu nhập kho",
        error:
          (t as any).importVoucher?.toast?.createError ??
          "Lỗi khi tạo phiếu nhập kho",
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
            onClick: () => void handleSubmit(),
          },
        },
      });
      onCreated();
    } catch {
      // goeyToast.promise already presents the error.
    } finally {
      setIsSubmitting(false);
    }
  };

  const goNext = () => {
    if (step < 3 && canGoNext()) setStep((step + 1) as StepId);
  };

  const goPrev = () => {
    if (step > 0) setStep((step - 1) as StepId);
  };

  return (
    <div className="space-y-4 pb-24 lg:pb-0">
      <div className="overflow-x-auto rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-2">
        <div className="grid min-w-[640px] grid-cols-4 gap-2 lg:min-w-0">
          {STEPS.map((stepConfig) => {
            const Icon = stepConfig.icon;
            const isActive = step === stepConfig.id;
            const isCompleted = step > stepConfig.id;
            const label =
              stepLabels[stepConfig.key as keyof typeof stepLabels] ??
              stepConfig.fallback;

            return (
              <button
                key={stepConfig.id}
                type="button"
                disabled={!isCompleted && !isActive}
                onClick={() => setStep(stepConfig.id)}
                className={`flex h-12 items-center gap-3 rounded-[var(--radius-sm)] px-3 text-left transition-all ${
                  isActive
                    ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                    : isCompleted
                      ? "bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]"
                      : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]"
                }`}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20">
                  <Icon size={15} />
                </span>
                <span className="min-w-0 truncate text-sm font-semibold">
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          <WarehouseSelectionPanel
            warehouses={warehouses}
            locations={allLocations}
            selectedWarehouseId={formData.warehouse_id}
            loading={warehousesLoading}
            locale={locale}
            onSelect={(warehouseId) =>
              setFormData((current) => ({
                ...current,
                warehouse_id: warehouseId,
                items: current.items.map((item) => ({
                  ...item,
                  warehouse_location_id: "",
                })),
              }))
            }
          />

          <section className="grid gap-4 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 lg:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[var(--color-text-secondary)]">
                {(t as any).importVoucher?.form?.supplier ?? "Nhà cung cấp"} *
              </span>
              <input
                value={formData.supplier_name}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    supplier_name: event.target.value,
                  })
                }
                placeholder={copy.supplierPlaceholder}
                className="h-12 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-base text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)] lg:h-10 lg:text-sm"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-[var(--color-text-secondary)]">
                {(t as any).importVoucher?.form?.purchaseOrder ??
                  "Mã đơn mua"}
              </span>
              <input
                value={formData.purchase_order_id}
                onChange={(event) =>
                  setFormData({
                    ...formData,
                    purchase_order_id: event.target.value,
                  })
                }
                placeholder={copy.poPlaceholder}
                className="h-12 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-base text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)] lg:h-10 lg:text-sm"
              />
            </label>

            <label className="block lg:col-span-2">
              <span className="mb-1 block text-sm font-semibold text-[var(--color-text-secondary)]">
                {(t as any).importVoucher?.form?.notes ?? "Ghi chú"}
              </span>
              <textarea
                value={formData.notes}
                onChange={(event) =>
                  setFormData({ ...formData, notes: event.target.value })
                }
                rows={3}
                placeholder={copy.notesPlaceholder}
                className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 py-3 text-base text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)] lg:text-sm"
              />
            </label>
          </section>
        </div>
      )}

      {step === 1 && (
        <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 lg:p-6">
          <FileUploadField
            files={files}
            onFilesChange={setFiles}
            disabled={isSubmitting}
            maxFiles={5}
            label={
              (t as any).importVoucher?.steps?.upload ?? "Tải chứng từ đính kèm (tuỳ chọn)"
            }
            hint={copy.uploadHint}
          />
        </section>
      )}

      {step === 2 && (
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {copy.chooseFromCatalog}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {products.length} {copy.products.toLowerCase()}
                </p>
              </div>
              <div className="relative sm:w-80">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                />
                <input
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder={copy.searchProduct}
                  className="h-12 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-9 pr-3 text-base outline-none transition-colors focus:border-[var(--color-border-focus)] lg:h-10 lg:text-sm"
                />
              </div>
            </div>

            {productsLoading ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-36 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-card)]"
                  />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] py-12 text-center text-sm text-[var(--color-text-muted)]">
                {copy.noProducts}
              </div>
            ) : (
              <div className="grid max-h-[560px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                {filteredProducts.map((product) => (
                  <ProductPickerCard
                    key={product.id}
                    product={product}
                    isAdded={addedProductIds.has(product.id)}
                    locale={locale}
                    onAdd={() => addProductToList(product.id)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 xl:sticky xl:top-4 xl:self-start">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {copy.selectedItems}
                </h2>
                <p className="text-xs text-[var(--color-text-muted)]">
                  {formData.items.length} {copy.products.toLowerCase()}
                </p>
              </div>
              <Package
                size={18}
                className="text-[var(--color-brand-primary)]"
              />
            </div>

            {formData.items.length === 0 ? (
              <div className="rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] py-10 text-center text-sm text-[var(--color-text-muted)]">
                {copy.emptyItems}
              </div>
            ) : (
              <div className="max-h-[560px] space-y-3 overflow-y-auto pr-1">
                {formData.items.map((item, index) => {
                  const product = products.find(
                    (productItem) => productItem.id === item.product_id,
                  );

                  return (
                    <div
                      key={item.id}
                      className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white p-3"
                    >
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[var(--color-brand-primary)]">
                            #{index + 1}
                          </p>
                          <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text-primary)]">
                            {item.product_name}
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                            {product?.code} · {product?.unit}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-accent-error)] transition-colors hover:bg-red-50"
                          aria-label={(t as any).common?.delete ?? "Xóa"}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                            {copy.expectedQty} *
                          </span>
                          <input
                            type="number"
                            min={1}
                            value={item.expected_quantity || ""}
                            onChange={(event) =>
                              updateItem(
                                item.id,
                                "expected_quantity",
                                Number(event.target.value),
                              )
                            }
                            className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-base outline-none focus:border-[var(--color-border-focus)] lg:h-9 lg:text-sm"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                            {copy.unitPrice}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={item.unit_price || ""}
                            onChange={(event) =>
                              updateItem(
                                item.id,
                                "unit_price",
                                Number(event.target.value),
                              )
                            }
                            className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-base outline-none focus:border-[var(--color-border-focus)] lg:h-9 lg:text-sm"
                          />
                        </label>
                        <label className="block sm:col-span-2">
                          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                            {copy.location} *
                          </span>
                          <select
                            value={item.warehouse_location_id}
                            onChange={(event) =>
                              updateItem(
                                item.id,
                                "warehouse_location_id",
                                event.target.value,
                              )
                            }
                            disabled={
                              locationsLoading || inventoryLoading || !formData.warehouse_id
                            }
                            className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-base outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50 lg:h-9 lg:text-sm"
                          >
                            <option value="">
                              {!formData.warehouse_id
                                ? copy.selectWarehouseFirst
                                : locationsLoading || inventoryLoading
                                  ? copy.loadingLocations
                                  : locations.length === 0
                                    ? copy.noLocations
                                    : copy.selectLocation}
                            </option>
                            {(() => {
                              const invLocations = getAllLocationsForProduct(item.product_id);
                              const invLocationIds = new Set(invLocations.map((il) => il.locationId));
                              // Sort: locations with existing stock first
                              const sorted = [...locations].sort((a, b) => {
                                const aHas = invLocationIds.has(a.id) ? 0 : 1;
                                const bHas = invLocationIds.has(b.id) ? 0 : 1;
                                return aHas - bHas;
                              });
                              return sorted.map((location) => {
                                const qty = getAtp(item.product_id, location.id);
                                const hasStock = invLocationIds.has(location.id);
                                return (
                                  <option key={location.id} value={location.id}>
                                    {location.name} ({location.code}){hasStock ? ` · Hiện có: ${qty}` : ""}
                                  </option>
                                );
                              });
                            })()}
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                            {copy.condition}
                          </span>
                          <select
                            value={item.condition}
                            onChange={(event) =>
                              updateItem(
                                item.id,
                                "condition",
                                event.target.value,
                              )
                            }
                            className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-base outline-none focus:border-[var(--color-border-focus)] lg:h-9 lg:text-sm"
                          >
                            <option value="GOOD">{copy.good}</option>
                            <option value="DAMAGED">{copy.damaged}</option>
                            <option value="MISSING">{copy.missing}</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-[11px] font-semibold uppercase text-[var(--color-text-muted)]">
                            {copy.itemNote}
                          </span>
                          <input
                            value={item.notes}
                            onChange={(event) =>
                              updateItem(item.id, "notes", event.target.value)
                            }
                            className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-base outline-none focus:border-[var(--color-border-focus)] lg:h-9 lg:text-sm"
                          />
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}

      {step === 3 && (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList
                size={18}
                className="text-[var(--color-brand-primary)]"
              />
              <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {copy.summary}
              </h2>
            </div>

            <div className="divide-y divide-[var(--color-border-soft)] text-sm">
              <div className="flex justify-between gap-4 py-3">
                <span className="text-[var(--color-text-muted)]">
                  {(t as any).importVoucher?.form?.warehouse ?? "Kho nhận"}
                </span>
                <span className="text-right font-semibold text-[var(--color-text-primary)]">
                  {selectedWarehouse?.name ?? copy.noWarehouse}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <span className="text-[var(--color-text-muted)]">
                  {(t as any).importVoucher?.form?.supplier ?? "Nhà cung cấp"}
                </span>
                <span className="text-right font-semibold text-[var(--color-text-primary)]">
                  {formData.supplier_name || "—"}
                </span>
              </div>
              <div className="flex justify-between gap-4 py-3">
                <span className="text-[var(--color-text-muted)]">
                  {(t as any).importVoucher?.form?.purchaseOrder ?? "Mã PO"}
                </span>
                <span className="text-right font-semibold text-[var(--color-text-primary)]">
                  {formData.purchase_order_id || copy.noPo}
                </span>
              </div>
              <div className="py-3">
                <span className="text-[var(--color-text-muted)]">
                  {(t as any).importVoucher?.form?.notes ?? "Ghi chú"}
                </span>
                <p className="mt-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3 text-[var(--color-text-secondary)]">
                  {formData.notes || copy.noNotes}
                </p>
              </div>
            </div>
          </div>

          <aside className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 lg:sticky lg:top-4 lg:self-start">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
                <p className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                  {copy.attachments}
                </p>
                <p className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">
                  {files.length}
                </p>
              </div>
              <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
                <p className="text-[10px] font-semibold uppercase text-[var(--color-text-muted)]">
                  {copy.products}
                </p>
                <p className="mt-2 text-xl font-bold text-[var(--color-text-primary)]">
                  {formData.items.length}
                </p>
              </div>
              <div className="rounded-[var(--radius-sm)] bg-blue-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-blue-700">
                  {copy.totalQty}
                </p>
                <p className="mt-2 text-xl font-bold text-blue-800">
                  {formatCurrency(totalQuantity)}
                </p>
              </div>
              <div className="rounded-[var(--radius-sm)] bg-emerald-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-emerald-700">
                  {copy.totalValue}
                </p>
                <p className="mt-2 text-xl font-bold text-emerald-800">
                  {formatCurrency(totalValue)}
                </p>
              </div>
            </div>
          </aside>
        </section>
      )}

      <div className="fixed bottom-[76px] left-0 right-0 z-30 border-t border-[var(--color-border-subtle)] bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:static lg:border-t-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={step === 0}
            className="flex h-12 items-center justify-center gap-2 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-surface-card)] disabled:opacity-30 lg:h-10"
          >
            <ChevronLeft size={16} />
            {(t as any).importVoucher?.form?.prev ?? "Quay lại"}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={!canGoNext()}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-5 text-sm font-semibold text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.99] disabled:opacity-50 lg:h-10 lg:flex-none"
            >
              {(t as any).importVoucher?.form?.next ?? "Tiếp theo"}
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-accent-success)] px-5 text-sm font-semibold text-white transition-all hover:brightness-95 active:scale-[0.99] disabled:opacity-50 lg:h-10 lg:flex-none"
            >
              {isSubmitting
                ? ((t as any).importVoucher?.toast?.creating ?? "Đang tạo...")
                : ((t as any).importVoucher?.form?.submit ?? "Gửi duyệt")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
