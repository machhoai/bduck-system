"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    ClipboardList,
    Package,
    Plus,
    Search,
    Trash2,
    Upload,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useInventoryByWarehouse } from "../../../hooks/useInventoryByWarehouse";
import { createExportVoucher } from "../../../hooks/useExportVoucherApi";
import { useProducts } from "../../../hooks/useProducts";
import {
    useWarehouseLocations,
    useWarehouses,
} from "../../../hooks/useWarehouses";
import { useTranslation } from "../../../lib/i18n";
import { uploadFile } from "../../../lib/uploadFile";
import { useUserStore } from "../../../stores/useUserStore";
import {
    FileUploadField,
    type SelectedFile,
} from "../../shared/FileUploadField";

type Locale = "vi" | "zh";
type StepId = 0 | 1 | 2 | 3;

interface Props {
    cloneData?: Record<string, unknown> | null;
    prefillWarehouseId?: string;
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

const COPY = {
    vi: {
        info: "Thông tin",
        upload: "Tải chứng từ",
        products: "Sản phẩm",
        confirm: "Xác nhận",
        transfer: "Điều chuyển",
        adjustment: "Điều chỉnh",
        exportType: "Loại xuất",
        sourceWarehouse: "Kho nguồn (xuất)",
        destinationWarehouse: "Kho đích (nhận)",
        executionWarehouse: "Kho thực hiện",
        chooseSource: "Chọn kho nguồn",
        chooseDestination: "Chọn kho đích",
        chooseWarehouse: "Chọn kho",
        loading: "Đang tải...",
        sameWarehouse: "Kho nguồn và kho đích không được trùng nhau",
        adjustmentReason: "Lý do điều chỉnh",
        notes: "Ghi chú",
        reasonPlaceholder: "Nhập lý do điều chỉnh...",
        notesPlaceholder: "Ghi chú bổ sung...",
        reasonRequired:
            "Bắt buộc nhập lý do khi loại xuất là điều chỉnh",
        uploadLabel: "Tải chứng từ xuất kho đính kèm (tuỳ chọn)",
        uploadHint: "PDF, DOCX, XLSX, CSV - tối đa 20MB mỗi tệp - tối đa 5 tệp",
        searchProduct: "Tìm sản phẩm theo tên, SKU hoặc barcode...",
        noProducts: "Không tìm thấy",
        selectedProducts: "Sản phẩm xuất kho",
        emptyProducts: "Chọn sản phẩm để thêm vào phiếu xuất.",
        delete: "Xóa",
        quantity: "SL xuất",
        unitPrice: "Đơn giá",
        location: "Vị trí kho",
        selectWarehouseFirst: "Chọn kho trước",
        noLocationForProduct:
            "Không có vị trí nào chứa sản phẩm này",
        selectLocation: "Chọn vị trí",
        available: "Khả dụng",
        atpWarning:
            "SL xuất ({quantity}) vượt quá khả dụng ({atp}). Phiếu sẽ bị từ chối khi duyệt.",
        confirmTitle: "Xác nhận thông tin xuất kho",
        attachments: "Tệp đính kèm",
        itemCount: "mặt hàng",
        fileCount: "tệp",
        back: "Quay lại",
        next: "Tiếp theo",
        submitting: "Đang tạo...",
        submit: "Gửi duyệt",
    },
    zh: {
        info: "信息",
        upload: "上传凭证",
        products: "产品",
        confirm: "确认",
        transfer: "调拨",
        adjustment: "调整",
        exportType: "出库类型",
        sourceWarehouse: "源仓库（出库）",
        destinationWarehouse: "目标仓库（收货）",
        executionWarehouse: "执行仓库",
        chooseSource: "选择源仓库",
        chooseDestination: "选择目标仓库",
        chooseWarehouse: "选择仓库",
        loading: "正在加载...",
        sameWarehouse: "源仓库和目标仓库不能相同",
        adjustmentReason: "调整原因",
        notes: "备注",
        reasonPlaceholder: "请输入调整原因...",
        notesPlaceholder: "补充备注...",
        reasonRequired: "调整出库必须填写原因",
        uploadLabel: "上传出库凭证（可选）",
        uploadHint: "PDF, DOCX, XLSX, CSV - 每个文件最多 20MB - 最多 5 个文件",
        searchProduct: "按名称、SKU 或条码搜索产品...",
        noProducts: "未找到",
        selectedProducts: "出库产品",
        emptyProducts: "选择产品以添加到出库单。",
        delete: "删除",
        quantity: "出库数量",
        unitPrice: "单价",
        location: "库位",
        selectWarehouseFirst: "请先选择仓库",
        noLocationForProduct: "没有包含此产品的库位",
        selectLocation: "选择库位",
        available: "可用",
        atpWarning:
            "出库数量 ({quantity}) 超过可用数量 ({atp})，审批时将被拒绝。",
        confirmTitle: "确认出库信息",
        attachments: "附件",
        itemCount: "项",
        fileCount: "个文件",
        back: "返回",
        next: "下一步",
        submitting: "正在创建...",
        submit: "提交审批",
    },
} as const;

const EXPORT_TYPES = [
    { value: "TRANSFER", labelKey: "transfer" },
    { value: "ADJUSTMENT", labelKey: "adjustment" },
] as const;

const STEPS = [
    { id: 0 as StepId, icon: ClipboardList, labelKey: "info" },
    { id: 1 as StepId, icon: Upload, labelKey: "upload" },
    { id: 2 as StepId, icon: Package, labelKey: "products" },
    { id: 3 as StepId, icon: CheckCircle2, labelKey: "confirm" },
] as const;

export default function CreateExportTab({
    cloneData,
    prefillWarehouseId,
    onCreated,
}: Props) {
    const { t, lang } = useTranslation();
    const copy = COPY[(lang || "vi") as Locale];
    const exportText = t.exportVoucher as any;
    const user = useUserStore((s) => s.user);
    const { warehouses, loading: warehousesLoading } = useWarehouses();
    const { products, loading: productsLoading } = useProducts();
    const [step, setStep] = useState<StepId>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [productSearch, setProductSearch] = useState("");
    const [files, setFiles] = useState<SelectedFile[]>([]);
    const [warehouseId, setWarehouseId] = useState(prefillWarehouseId || "");
    const [exportType, setExportType] = useState("TRANSFER");
    const [destinationWarehouseId, setDestinationWarehouseId] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<ExportItemData[]>([]);

    useEffect(() => {
        if (prefillWarehouseId) {
            setWarehouseId(prefillWarehouseId);
        }
    }, [prefillWarehouseId]);

    useEffect(() => {
        if (!cloneData) return;
        setWarehouseId((cloneData.warehouse_id as string) || "");
        setExportType((cloneData.export_type as string) || "TRANSFER");
        setDestinationWarehouseId(
            (cloneData.destination_warehouse_id as string) || "",
        );
        setNotes((cloneData.notes as string) || "");
        setStep(0);
    }, [cloneData]);

    const { locations, loading: locationsLoading } = useWarehouseLocations(
        warehouseId || undefined,
    );
    const { getLocationsForProduct, getAtp, loading: inventoryLoading } =
        useInventoryByWarehouse(warehouseId || undefined);

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

    const canGoNext = useCallback((): boolean => {
        switch (step) {
            case 0: {
                const baseValid = warehouseId !== "" && exportType !== "";
                if (exportType === "TRANSFER") {
                    return (
                        baseValid &&
                        destinationWarehouseId !== "" &&
                        destinationWarehouseId !== warehouseId
                    );
                }
                if (exportType === "ADJUSTMENT") {
                    return baseValid && notes.trim().length > 0;
                }
                return baseValid;
            }
            case 1:
                return true;
            case 2:
                return (
                    items.length > 0 &&
                    items.every(
                        (item) =>
                            item.product_id !== "" &&
                            item.quantity > 0 &&
                            item.warehouse_location_id !== "",
                    )
                );
            default:
                return true;
        }
    }, [step, warehouseId, exportType, destinationWarehouseId, notes, items]);

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

    const updateItem = (
        id: string,
        field: keyof ExportItemData,
        value: unknown,
    ) => {
        setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
        );
    };

    const removeItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;
        setIsSubmitting(true);

        const submitAction = async () => {
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
                            prev.map((pf) =>
                                pf.id === f.id ? { ...pf, progress: percent } : pf,
                            ),
                        );
                    },
                );
                uploadedUrls.push(url);
            }

            await createExportVoucher({
                warehouse_id: warehouseId,
                export_type: exportType,
                recipient_name:
                    exportType === "TRANSFER"
                        ? warehouses.find((w) => w.id === destinationWarehouseId)?.name ||
                        undefined
                        : undefined,
                recipient_department:
                    exportType === "TRANSFER" ? destinationWarehouseId : undefined,
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
                loading: exportText.toast.creating,
                success: exportText.toast.createSuccess,
                error: exportText.toast.createError,
                description: {
                    success: exportText.toast.createSuccessDesc,
                    error: exportText.toast.createErrorDesc,
                },
                action: {
                    error: { label: t.common.retry, onClick: () => void handleSubmit() },
                },
            });
            onCreated();
        } catch {
            // Toast handles error.
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-col gap-3">
            <div className=" mx-auto flex items-center gap-1 overflow-x-auto py-1">
                {STEPS.map((s, index) => {
                    const Icon = s.icon;
                    const isActive = step === s.id;
                    const isCompleted = step > s.id;
                    return (
                        <div key={s.id} className="flex items-center gap-1">
                            {index > 0 && (
                                <div
                                    className={`h-px w-6 shrink-0 lg:w-10 ${isCompleted ? "bg-orange-600" : "bg-gray-200"
                                        }`}
                                />
                            )}
                            <button
                                type="button"
                                onClick={() => {
                                    if (isCompleted || isActive) setStep(s.id);
                                }}
                                disabled={!isCompleted && !isActive}
                                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${isActive
                                    ? "bg-orange-600 text-white shadow-sm"
                                    : isCompleted
                                        ? "bg-orange-100 text-orange-600"
                                        : "bg-gray-100 text-gray-400"
                                    }`}
                            >
                                <Icon size={14} />
                                <span className="hidden sm:inline">{copy[s.labelKey]}</span>
                            </button>
                        </div>
                    );
                })}
            </div>

            <div className="rounded-xl border border-gray-100 bg-white p-4 lg:p-4">
                {step === 0 && (
                    <div className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-600">
                                {copy.exportType} *
                            </label>
                            <div className="flex gap-2">
                                {EXPORT_TYPES.map((et) => (
                                    <button
                                        key={et.value}
                                        type="button"
                                        onClick={() => {
                                            setExportType(et.value);
                                            setDestinationWarehouseId("");
                                        }}
                                        className={`flex-1 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all ${exportType === et.value
                                            ? "border-orange-600 bg-orange-50 text-orange-700"
                                            : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                                            }`}
                                    >
                                        {copy[et.labelKey]}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {exportType === "TRANSFER" && (
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-600">
                                        {copy.sourceWarehouse} *
                                    </label>
                                    <select
                                        value={warehouseId}
                                        onChange={(e) => setWarehouseId(e.target.value)}
                                        disabled={warehousesLoading}
                                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                                    >
                                        <option value="">
                                            {warehousesLoading ? copy.loading : copy.chooseSource}
                                        </option>
                                        {warehouses.map((wh) => (
                                            <option
                                                key={wh.id}
                                                value={wh.id}
                                                disabled={wh.id === destinationWarehouseId}
                                            >
                                                {wh.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="mb-1 block text-sm font-medium text-gray-600">
                                        {copy.destinationWarehouse} *
                                    </label>
                                    <select
                                        value={destinationWarehouseId}
                                        onChange={(e) => setDestinationWarehouseId(e.target.value)}
                                        disabled={warehousesLoading}
                                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                                    >
                                        <option value="">
                                            {warehousesLoading
                                                ? copy.loading
                                                : copy.chooseDestination}
                                        </option>
                                        {warehouses
                                            .filter((wh) => wh.id !== warehouseId)
                                            .map((wh) => (
                                                <option key={wh.id} value={wh.id}>
                                                    {wh.name}
                                                </option>
                                            ))}
                                    </select>
                                </div>
                                {warehouseId &&
                                    destinationWarehouseId &&
                                    warehouseId === destinationWarehouseId && (
                                        <div className="col-span-full flex items-center gap-1.5 text-xs text-red-500">
                                            <AlertTriangle size={14} />
                                            <span>{copy.sameWarehouse}</span>
                                        </div>
                                    )}
                            </div>
                        )}

                        {exportType === "ADJUSTMENT" && (
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-600">
                                    {copy.executionWarehouse} *
                                </label>
                                <select
                                    value={warehouseId}
                                    onChange={(e) => setWarehouseId(e.target.value)}
                                    disabled={warehousesLoading}
                                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:opacity-50"
                                >
                                    <option value="">
                                        {warehousesLoading ? copy.loading : copy.chooseWarehouse}
                                    </option>
                                    {warehouses.map((wh) => (
                                        <option key={wh.id} value={wh.id}>
                                            {wh.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-600">
                                {exportType === "ADJUSTMENT"
                                    ? `${copy.adjustmentReason} *`
                                    : copy.notes}
                            </label>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                placeholder={
                                    exportType === "ADJUSTMENT"
                                        ? copy.reasonPlaceholder
                                        : copy.notesPlaceholder
                                }
                                className={`w-full resize-none rounded-lg border bg-white px-3 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 ${exportType === "ADJUSTMENT" && notes.trim().length === 0
                                    ? "border-red-300"
                                    : "border-gray-200"
                                    }`}
                            />
                            {exportType === "ADJUSTMENT" && notes.trim().length === 0 && (
                                <p className="mt-1 text-xs text-red-500">
                                    {copy.reasonRequired}
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {step === 1 && (
                    <FileUploadField
                        files={files}
                        onFilesChange={setFiles}
                        disabled={isSubmitting}
                        maxFiles={5}
                        label={copy.uploadLabel}
                        hint={copy.uploadHint}
                    />
                )}

                {step === 2 && (
                    <div className="space-y-4">
                        <div className="relative">
                            <Search
                                size={16}
                                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
                                type="text"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                placeholder={copy.searchProduct}
                                className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100"
                            />
                        </div>

                        <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50">
                            {productsLoading ? (
                                <div className="flex items-center justify-center py-4 text-xs text-gray-400">
                                    {copy.loading}
                                </div>
                            ) : filteredProducts.length === 0 ? (
                                <div className="flex items-center justify-center py-4 text-xs text-gray-400">
                                    {copy.noProducts}
                                </div>
                            ) : (
                                filteredProducts.map((p) => {
                                    const isAdded = addedProductIds.has(p.id);
                                    return (
                                        <div
                                            key={p.id}
                                            className={`flex items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 ${isAdded ? "bg-orange-50 opacity-60" : "hover:bg-white"
                                                }`}
                                        >
                                            <div className="min-w-0 flex-1">
                                                <p className="truncate text-sm font-medium text-gray-900">
                                                    {p.name}
                                                </p>
                                                <div className="flex gap-2 text-xs text-gray-500">
                                                    <span>SKU: {p.code}</span>
                                                    <span>/ {p.unit}</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                disabled={isAdded}
                                                onClick={() => addProduct(p.id)}
                                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-orange-600 text-white transition-all hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-30"
                                            >
                                                <Plus size={14} />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        <div>
                            <p className="mb-2 text-sm font-medium text-gray-600">
                                {copy.selectedProducts}{" "}
                                {items.length > 0 && (
                                    <span className="text-xs text-gray-400">
                                        ({items.length})
                                    </span>
                                )}
                            </p>
                            {items.length === 0 ? (
                                <p className="rounded-lg border border-dashed border-gray-200 py-4 text-center text-sm text-gray-400">
                                    {copy.emptyProducts}
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {items.map((item, index) => {
                                        const product = products.find(
                                            (p) => p.id === item.product_id,
                                        );
                                        return (
                                            <div
                                                key={item.id}
                                                className="rounded-lg border border-gray-100 bg-gray-50 p-3"
                                            >
                                                <div className="mb-2 flex items-center justify-between">
                                                    <div className="flex min-w-0 items-center gap-2">
                                                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-orange-100 text-xxs font-semibold text-orange-600">
                                                            {index + 1}
                                                        </span>
                                                        <span className="truncate text-sm font-medium text-gray-900">
                                                            {item.product_name}
                                                        </span>
                                                        <span className="text-xs text-gray-400">
                                                            {product?.code} / {product?.unit}
                                                        </span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeItem(item.id)}
                                                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-red-500 hover:bg-red-50"
                                                    >
                                                        <Trash2 size={12} />
                                                        {copy.delete}
                                                    </button>
                                                </div>
                                                <div className="grid gap-3 sm:grid-cols-3">
                                                    <label>
                                                        <span className="mb-0.5 block text-xxs text-gray-400">
                                                            {copy.quantity} *
                                                        </span>
                                                        <input
                                                            type="number"
                                                            value={item.quantity || ""}
                                                            onChange={(e) =>
                                                                updateItem(
                                                                    item.id,
                                                                    "quantity",
                                                                    Number(e.target.value),
                                                                )
                                                            }
                                                            min={1}
                                                            className="w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-orange-400"
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className="mb-0.5 block text-xxs text-gray-400">
                                                            {copy.unitPrice}
                                                        </span>
                                                        <input
                                                            type="number"
                                                            value={item.unit_price || ""}
                                                            onChange={(e) =>
                                                                updateItem(
                                                                    item.id,
                                                                    "unit_price",
                                                                    Number(e.target.value),
                                                                )
                                                            }
                                                            min={0}
                                                            className="w-full rounded border border-gray-200 bg-white px-2.5 py-2 text-xs outline-none focus:border-orange-400"
                                                        />
                                                    </label>
                                                    <label>
                                                        <span className="mb-0.5 block text-xxs text-gray-400">
                                                            {copy.location} *
                                                        </span>
                                                        {(() => {
                                                            const productLocations = getLocationsForProduct(
                                                                item.product_id,
                                                            );
                                                            const hasLocations = productLocations.length > 0;
                                                            const isLoading =
                                                                locationsLoading || inventoryLoading;
                                                            return (
                                                                <select
                                                                    value={item.warehouse_location_id}
                                                                    onChange={(e) =>
                                                                        updateItem(
                                                                            item.id,
                                                                            "warehouse_location_id",
                                                                            e.target.value,
                                                                        )
                                                                    }
                                                                    disabled={
                                                                        isLoading || !warehouseId || !hasLocations
                                                                    }
                                                                    className={`w-full rounded border bg-white px-2.5 py-2 text-xs outline-none focus:border-orange-400 disabled:opacity-50 ${!hasLocations && !isLoading && warehouseId
                                                                        ? "border-amber-300"
                                                                        : "border-gray-200"
                                                                        }`}
                                                                >
                                                                    <option value="">
                                                                        {!warehouseId
                                                                            ? copy.selectWarehouseFirst
                                                                            : isLoading
                                                                                ? copy.loading
                                                                                : !hasLocations
                                                                                    ? copy.noLocationForProduct
                                                                                    : copy.selectLocation}
                                                                    </option>
                                                                    {productLocations.map((pl) => {
                                                                        const loc = locations.find(
                                                                            (l) => l.id === pl.locationId,
                                                                        );
                                                                        return (
                                                                            <option
                                                                                key={pl.locationId}
                                                                                value={pl.locationId}
                                                                            >
                                                                                {loc
                                                                                    ? `${loc.name} (${loc.code})`
                                                                                    : pl.locationId}{" "}
                                                                                / {copy.available}: {pl.atpQty}
                                                                            </option>
                                                                        );
                                                                    })}
                                                                </select>
                                                            );
                                                        })()}
                                                    </label>
                                                </div>
                                                {item.warehouse_location_id &&
                                                    item.quantity > 0 &&
                                                    (() => {
                                                        const atp = getAtp(
                                                            item.product_id,
                                                            item.warehouse_location_id,
                                                        );
                                                        if (item.quantity <= atp) return null;
                                                        return (
                                                            <div className="mt-2 flex items-center gap-1.5 rounded-md bg-amber-50 px-2.5 py-1.5 text-xxs text-amber-700">
                                                                <AlertTriangle
                                                                    size={12}
                                                                    className="shrink-0"
                                                                />
                                                                <span>
                                                                    {copy.atpWarning
                                                                        .replace(
                                                                            "{quantity}",
                                                                            String(item.quantity),
                                                                        )
                                                                        .replace("{atp}", String(atp))}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {step === 3 && (
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900">
                            {copy.confirmTitle}
                        </h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between border-b border-gray-100 py-2">
                                <span className="text-gray-500">{copy.exportType}</span>
                                <span className="font-medium">
                                    {copy[
                                        (EXPORT_TYPES.find((e) => e.value === exportType)
                                            ?.labelKey ?? "transfer") as "transfer" | "adjustment"
                                    ]}
                                </span>
                            </div>
                            <div className="flex justify-between border-b border-gray-100 py-2">
                                <span className="text-gray-500">
                                    {exportType === "TRANSFER"
                                        ? copy.sourceWarehouse
                                        : copy.executionWarehouse}
                                </span>
                                <span className="font-medium">
                                    {warehouses.find((w) => w.id === warehouseId)?.name || "-"}
                                </span>
                            </div>
                            {exportType === "TRANSFER" && (
                                <div className="flex justify-between border-b border-gray-100 py-2">
                                    <span className="text-gray-500">
                                        {copy.destinationWarehouse}
                                    </span>
                                    <span className="font-medium">
                                        {warehouses.find((w) => w.id === destinationWarehouseId)
                                            ?.name || "-"}
                                    </span>
                                </div>
                            )}
                            <div className="flex justify-between border-b border-gray-100 py-2">
                                <span className="text-gray-500">{copy.attachments}</span>
                                <span className="font-medium">
                                    {files.length} {copy.fileCount}
                                </span>
                            </div>
                            <div className="flex justify-between py-2">
                                <span className="text-gray-500">{copy.products}</span>
                                <span className="font-medium">
                                    {items.length} {copy.itemCount}
                                </span>
                            </div>
                        </div>
                        {notes && (
                            <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-500">
                                <span className="font-medium">
                                    {exportType === "ADJUSTMENT"
                                        ? copy.adjustmentReason
                                        : copy.notes}
                                    :
                                </span>{" "}
                                {notes}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={() => step > 0 && setStep((step - 1) as StepId)}
                    disabled={step === 0}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50 disabled:opacity-30"
                >
                    <ChevronLeft size={14} />
                    {copy.back}
                </button>

                {step < STEPS.length - 1 ? (
                    <button
                        type="button"
                        onClick={() => canGoNext() && setStep((step + 1) as StepId)}
                        disabled={!canGoNext()}
                        className="flex items-center gap-1.5 rounded-lg bg-orange-600 px-4 py-2 text-xs font-medium text-white transition-all hover:bg-orange-600 disabled:opacity-50"
                    >
                        {copy.next}
                        <ChevronRight size={14} />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-emerald-600 disabled:opacity-50"
                    >
                        {isSubmitting ? copy.submitting : copy.submit}
                    </button>
                )}
            </div>
        </div>
    );
}
