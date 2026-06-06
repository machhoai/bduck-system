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
import { VoucherExcelImportPanel } from "./VoucherExcelImportPanel";
import { QuickLocationAssign } from "./QuickLocationAssign";
import { useProcessConfig } from "../../../hooks/useProcessConfig";
import { ActionOtpModal } from "../../shared/ActionOtpModal";

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
        upload: "Tải chứng từ",
        info: "Thông tin",
        confirm: "Xác nhận",
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
        upload: "上传文件",
        info: "信息",
        confirm: "确认",
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
    copy,
}: {
    product: Product;
    isAdded: boolean;
    onAdd: () => void;
    copy: Record<string, string>;
}) {
    return (
        <div
            className={`rounded-[var(--radius-sm)] border p-3 transition-all ${isAdded
                ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                : "border-[var(--color-border-subtle)] bg-white hover:border-[var(--color-border-focus)]"
                }`}
        >
            <div className="flex gap-3">
                <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--color-surface-card)] text-[var(--color-brand-primary)]">
                    <Package size={20} />
                </div>
                <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-semibold text-[var(--color-text-primary)]">
                        {product.name}
                    </p>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                        SKU: {product.code} / {product.unit}
                    </p>
                    {product.barcode && (
                        <p className="mt-0.5 truncate text-xxs text-[var(--color-text-muted)]">
                            {product.barcode}
                        </p>
                    )}
                </div>
            </div>
            <button
                type="button"
                disabled={isAdded}
                onClick={onAdd}
                className="mt-3 flex h-8 w-full items-center justify-center gap-2 rounded-[var(--radius-xs)] bg-[var(--color-brand-primary)] text-sm font-semibold text-white transition-all hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98] disabled:bg-[var(--color-surface-card)] disabled:text-[var(--color-text-muted)]"
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

    const { config: processConfig } = useProcessConfig("IMPORT_VOUCHER", formData.warehouse_id || undefined);
    const [showOtpModal, setShowOtpModal] = useState(false);

    const { locations, loading: locationsLoading } = useWarehouseLocations(
        formData.warehouse_id || undefined,
    );
    const { getAllLocationsForProduct, getLocationsForProduct, getAtp, loading: inventoryLoading } =
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
            upload: labels?.upload ?? copy.upload,
            info: labels?.info ?? copy.info,
            items: labels?.items ?? copy.products,
            confirm: labels?.confirm ?? copy.confirm,
        };
    }, [copy, t]);

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
                return processConfig?.require_evidence ? files.length > 0 : true;
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

    const bulkAddItems = useCallback(
        (
            items: {
                productId: string;
                quantity: number;
                unitPrice: number;
                notes: string;
                locationCode: string;
            }[]
        ) => {
            setFormData((current) => {
                const existingIds = new Set(current.items.map((i) => i.product_id));
                const newItems = items
                    .filter((item) => !existingIds.has(item.productId))
                    .map((item) => {
                        const product = products.find((p) => p.id === item.productId);

                        // Try to resolve location from Excel locationCode
                        let resolvedLocationId = "";
                        if (item.locationCode) {
                            const code = item.locationCode.trim().toLowerCase();
                            const matched = locations.find(
                                (loc) =>
                                    loc.code.toLowerCase() === code ||
                                    loc.name.toLowerCase() === code,
                            );
                            if (matched) resolvedLocationId = matched.id;
                        }

                        // Fallback: auto-assign from existing inventory
                        if (!resolvedLocationId) {
                            const invLocs = getLocationsForProduct(item.productId);
                            if (invLocs.length > 0) {
                                // Pick location with highest ATP
                                const best = invLocs.reduce((a, b) =>
                                    b.atpQty > a.atpQty ? b : a,
                                );
                                resolvedLocationId = best.locationId;
                            }
                        }

                        return {
                            id: crypto.randomUUID(),
                            product_id: item.productId,
                            product_name: product?.name ?? item.productId,
                            warehouse_location_id: resolvedLocationId,
                            expected_quantity: item.quantity,
                            actual_quantity: 0,
                            unit_price: item.unitPrice,
                            condition: "GOOD",
                            notes: item.notes,
                        };
                    });
                return { ...current, items: [...current.items, ...newItems] };
            });
        },
        [products, locations, getLocationsForProduct]
    );

    // Batch assign locations from QuickLocationAssign
    const batchAssignLocations = useCallback(
        (assignments: Map<string, string>) => {
            setFormData((current) => ({
                ...current,
                items: current.items.map((item) => {
                    const newLocId = assignments.get(item.id);
                    return newLocId
                        ? { ...item, warehouse_location_id: newLocId }
                        : item;
                }),
            }));
        },
        [],
    );

    // Get best location (highest ATP) for QuickLocationAssign
    const getBestLocationForProduct = useCallback(
        (productId: string): string | null => {
            const invLocs = getLocationsForProduct(productId);
            if (invLocs.length === 0) return null;
            const best = invLocs.reduce((a, b) =>
                b.atpQty > a.atpQty ? b : a,
            );
            return best.locationId;
        },
        [getLocationsForProduct],
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
        
        if (processConfig?.require_evidence && files.length === 0) {
            gooeyToast.error((t as any).importVoucher?.form?.requireEvidence ?? "Bắt buộc phải tải lên chứng từ đính kèm");
            return;
        }

        if (processConfig?.require_otp) {
            setShowOtpModal(true);
            return;
        }

        executeSubmit();
    };

    const executeSubmit = async (otp?: string) => {
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
                otp,
            });
        };

        const promise = submitAction();
        
        gooeyToast.promise(promise, {
            loading:
                (t as any).importVoucher?.toast?.creating ??
                "Đang tạo phiếu nhập kho...",
            success:
                (t as any).importVoucher?.toast?.createSuccess ??
                "Đã tạo phiếu nhập kho",
            error: (err: any) => err?.message || ((t as any).importVoucher?.toast?.createError ?? "Lỗi khi tạo phiếu nhập kho"),
            description: {
                success:
                    (t as any).importVoucher?.toast?.createSuccessDesc ??
                    "Phiếu đã được gửi vào quy trình duyệt.",
                error: (t as any).importVoucher?.toast?.createErrorDesc ?? "Vui lòng thử lại hoặc liên hệ quản trị viên.",
            },
            action: {
                error: {
                    label: (t as any).common?.retry ?? "Thử lại",
                    onClick: () => {
                        if (processConfig?.require_otp && !showOtpModal) {
                            setShowOtpModal(true);
                        } else {
                            void executeSubmit(otp);
                        }
                    },
                },
            },
        });

        try {
            await promise;
            onCreated();
            setShowOtpModal(false);
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
        <div className="flex flex-1 h-full flex-col gap-4">
            <div className="flex items-center justify-between w-full gap-1 overflow-x-auto py-1">
                <button
                    type="button"
                    onClick={goPrev}
                    disabled={step === 0}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--color-neutral-200)] px-4 py-2 text-xs font-medium text-[var(--color-neutral-600)] transition-all hover:bg-[var(--color-neutral-50)] disabled:opacity-30"
                >
                    <ChevronLeft size={16} />
                    {(t as any).importVoucher?.form?.prev ?? "Quay lại"}
                </button>

                <div className="flex">
                    {STEPS.map((stepConfig, idx) => {
                        const Icon = stepConfig.icon;
                        const isActive = step === stepConfig.id;
                        const isCompleted = step > stepConfig.id;
                        const label =
                            stepLabels[stepConfig.key as keyof typeof stepLabels] ??
                            stepConfig.fallback;

                        return (
                            <div key={stepConfig.id} className="flex items-center gap-1">
                                {idx > 0 && (
                                    <div
                                        className={`h-px w-6 shrink-0 lg:w-10 ${isCompleted ? "bg-[var(--color-status-export-icon)]" : "bg-[var(--color-neutral-200)]"
                                            }`}
                                    />
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (isCompleted || isActive) setStep(stepConfig.id);
                                    }}
                                    disabled={!isCompleted && !isActive}
                                    className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${isActive
                                        ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                        : isCompleted
                                            ? "bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]"
                                            : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]"
                                        }`}
                                >
                                    <Icon size={14} />
                                    <span className="hidden sm:inline">{label}</span>
                                </button>
                            </div>
                        );
                    })}
                </div>

                {step < 3 ? (
                    <button
                        type="button"
                        onClick={goNext}
                        disabled={!canGoNext()}
                        className="flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-xs font-medium text-white transition-all hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50"
                    >
                        {(t as any).importVoucher?.form?.next ?? "Tiếp theo"}
                        <ChevronRight size={16} />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-1.5 rounded-lg px-5 bg-[var(--color-brand-primary)] py-2 text-xs font-semibold text-white transition-all disabled:opacity-50"
                    >
                        {isSubmitting
                            ? ((t as any).importVoucher?.toast?.creating ?? "Đang tạo...")
                            : ((t as any).importVoucher?.form?.submit ?? "Gửi duyệt")}
                    </button>
                )}
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
                                className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-base text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)] lg:h-8 lg:text-sm"
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
                                className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-base text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)] lg:h-8 lg:text-sm"
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
                <section className="flex-1 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 lg:p-4">
                    <FileUploadField
                        files={files}
                        onFilesChange={setFiles}
                        disabled={isSubmitting}
                        maxFiles={5}
                        label={
                            processConfig?.require_evidence 
                                ? ((t as any).importVoucher?.steps?.uploadRequired ?? "Tải chứng từ đính kèm (Bắt buộc)")
                                : ((t as any).importVoucher?.steps?.upload ?? "Tải chứng từ đính kèm (tuỳ chọn)")
                        }
                        hint={copy.uploadHint}
                    />
                </section>
            )}

            {step === 2 && (
                <div className="flex-1 flex gap-3">
                    <section className="h-full flex-1 flex flex-col gap-2">
                        {/* Excel import panel - inline, above catalog */}
                        <VoucherExcelImportPanel
                            uploadedFiles={files}
                            products={products}
                            onImport={bulkAddItems}
                        />
                        <div className="rounded-[var(--radius-md)] flex-1 border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
                            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                        {copy.chooseFromCatalog}
                                    </h2>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        {products.length} {copy?.products?.toLowerCase() ?? ""}
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
                                        className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-9 pr-3 text-base outline-none transition-colors focus:border-[var(--color-border-focus)] lg:h-8 lg:text-sm"
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
                                <div className="grid gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                                    {filteredProducts.map((product) => (
                                        <ProductPickerCard
                                            key={product.id}
                                            product={product}
                                            isAdded={addedProductIds.has(product.id)}
                                            copy={copy}
                                            onAdd={() => addProductToList(product.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    </section>

                    <section className="rounded-[var(--radius-md)] flex-1 flex flex-col border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
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

                        {/* Quick Location Assign toolbar */}
                        {formData.items.length > 0 && formData.warehouse_id && (
                            <QuickLocationAssign
                                items={formData.items}
                                products={products}
                                locations={locations}
                                getBestLocation={getBestLocationForProduct}
                                onAssign={batchAssignLocations}
                                disabled={locationsLoading || inventoryLoading}
                            />
                        )}

                        {formData.items.length === 0 ? (
                            <div className="flex flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] text-sm text-[var(--color-text-muted)]">
                                {copy.emptyItems}
                            </div>
                        ) : (
                            <div className="flex-1 h-full space-y-2 overflow-y-auto pr-1">
                                {formData.items.map((item, index) => {
                                    const product = products.find(
                                        (productItem) => productItem.id === item.product_id,
                                    );

                                    // Location status for badge
                                    const invLocations = getAllLocationsForProduct(item.product_id);
                                    const invLocationIds = new Set(invLocations.map((il) => il.locationId));
                                    const hasLocation = !!item.warehouse_location_id;
                                    const locationHasStock = hasLocation && invLocationIds.has(item.warehouse_location_id);
                                    const selectedLocation = hasLocation
                                        ? locations.find((l) => l.id === item.warehouse_location_id)
                                        : null;
                                    const subtotal = (item.expected_quantity || 0) * (item.unit_price || 0);

                                    // Sort locations: existing stock first
                                    const sortedLocations = [...locations].sort((a, b) => {
                                        const aHas = invLocationIds.has(a.id) ? 0 : 1;
                                        const bHas = invLocationIds.has(b.id) ? 0 : 1;
                                        return aHas - bHas;
                                    });

                                    return (
                                        <div
                                            key={item.id}
                                            className="group rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white transition-shadow hover:shadow-sm"
                                        >
                                            {/* ── Card Header ── */}
                                            <div className="flex items-center gap-2.5 border-b border-[var(--color-border-soft)] px-3 py-2">
                                                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--color-brand-primary)] text-xxs font-bold text-white">
                                                    {index + 1}
                                                </span>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                                        {item.product_name}
                                                    </p>
                                                    <p className="text-xxs text-[var(--color-text-muted)]">
                                                        {product?.code} · {product?.unit}
                                                        {product?.barcode ? ` · ${product.barcode}` : ""}
                                                    </p>
                                                </div>
                                                {/* Location badge */}
                                                {hasLocation ? (
                                                    locationHasStock ? (
                                                        <span className="shrink-0 rounded-full bg-[var(--color-status-completed-bg-muted)] px-2 py-0.5 text-xxs font-semibold text-[var(--color-status-completed-text)]">
                                                            ✓ {selectedLocation?.code || ""}
                                                        </span>
                                                    ) : (
                                                        <span className="shrink-0 rounded-full bg-[var(--color-status-pending-bg-muted)] px-2 py-0.5 text-xxs font-semibold text-[var(--color-status-pending-text)]">
                                                            ⬡ {selectedLocation?.code || ""}
                                                        </span>
                                                    )
                                                ) : (
                                                    <span className="shrink-0 rounded-full bg-[var(--color-error-bg-muted)] px-2 py-0.5 text-xxs font-semibold text-[var(--color-error-text)]">
                                                        ● {locale === "zh" ? "未选择" : "Chưa chọn"}
                                                    </span>
                                                )}
                                                <button
                                                    type="button"
                                                    onClick={() => removeItem(item.id)}
                                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-text-muted)] opacity-0 transition-all hover:bg-[var(--color-error-bg)] hover:text-[var(--color-accent-error)] group-hover:opacity-100"
                                                    aria-label={(t as any).common?.delete ?? "Delete"}
                                                >
                                                    <Trash2 size={13} />
                                                </button>
                                            </div>

                                            {/* ── Card Body ── */}
                                            <div className="px-3 py-2.5">
                                                {/* Row 1: Qty / Price / Condition / Note */}
                                                <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                                                    <label className="block">
                                                        <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
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
                                                            className="h-8 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                                                        />
                                                    </label>
                                                    <label className="block">
                                                        <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
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
                                                            className="h-8 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                                                        />
                                                    </label>
                                                    <label className="block">
                                                        <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
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
                                                            className="h-8 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                                                        >
                                                            <option value="GOOD">{copy.good}</option>
                                                            <option value="DAMAGED">{copy.damaged}</option>
                                                            <option value="MISSING">{copy.missing}</option>
                                                        </select>
                                                    </label>
                                                    <label className="block">
                                                        <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                                            {copy.itemNote}
                                                        </span>
                                                        <input
                                                            value={item.notes}
                                                            onChange={(event) =>
                                                                updateItem(item.id, "notes", event.target.value)
                                                            }
                                                            className="h-8 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                                                        />
                                                    </label>
                                                </div>

                                                {/* Row 2: Location (full width) + subtotal */}
                                                <div className="mt-2 flex items-end gap-3">
                                                    <label className="block flex-1">
                                                        <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
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
                                                            className="h-8 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50"
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
                                                            {sortedLocations.map((location) => {
                                                                const qty = getAtp(item.product_id, location.id);
                                                                const hasStock = invLocationIds.has(location.id);
                                                                return (
                                                                    <option key={location.id} value={location.id}>
                                                                        {location.name} ({location.code}){hasStock ? ` · ATP: ${qty}` : ""}
                                                                    </option>
                                                                );
                                                            })}
                                                        </select>
                                                    </label>
                                                    {subtotal > 0 && (
                                                        <p className="shrink-0 pb-1 text-xs font-semibold text-[var(--color-text-secondary)]">
                                                            = {formatCurrency(subtotal)}
                                                        </p>
                                                    )}
                                                </div>
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
                                    {formData.supplier_name || "-"}
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
                                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                    {copy.attachments}
                                </p>
                                <p className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">
                                    {files.length}
                                </p>
                            </div>
                            <div className="rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3">
                                <p className="text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                    {copy.products}
                                </p>
                                <p className="mt-2 text-lg font-bold text-[var(--color-text-primary)]">
                                    {formData.items.length}
                                </p>
                            </div>
                            <div className="rounded-[var(--radius-sm)] bg-[var(--color-status-receiving-bg)] p-3">
                                <p className="text-xxs font-semibold uppercase text-[var(--color-status-receiving-text)]">
                                    {copy.totalQty}
                                </p>
                                <p className="mt-2 text-lg font-bold text-[var(--color-brand-primary-dark)]">
                                    {formatCurrency(totalQuantity)}
                                </p>
                            </div>
                            <div className="rounded-[var(--radius-sm)] bg-[var(--color-status-completed-bg)] p-3">
                                <p className="text-xxs font-semibold uppercase text-[var(--color-status-completed-text)]">
                                    {copy.totalValue}
                                </p>
                                <p className="mt-2 text-lg font-bold text-[var(--color-status-completed-text)]">
                                    {formatCurrency(totalValue)}
                                </p>
                            </div>
                        </div>
                    </aside>
                </section>
            )}

            {showOtpModal && (
                <ActionOtpModal
                    onConfirm={executeSubmit}
                    onCancel={() => setShowOtpModal(false)}
                    isSubmitting={isSubmitting}
                    title="Xác thực gửi duyệt phiếu nhập"
                    description="Quá trình gửi duyệt phiếu nhập này yêu cầu xác thực OTP."
                />
            )}
        </div>
    );
}
