"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    AlertTriangle,
    ArrowRightLeft,
    ArrowUpRight,
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
import TransferRouteMap from "./TransferRouteMap";
import { WarehouseSelectionPanel } from "../import-vouchers/WarehouseSelectionPanel";
import { gooeyToast } from "goey-toast";
import { useInventoryByWarehouse } from "../../../hooks/useInventoryByWarehouse";
import { useProducts } from "../../../hooks/useProducts";
import { createTransferOrder, updateTransferOrder } from "../../../hooks/useTransferOrderApi";
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
import { VoucherExcelImportPanel } from "../import-vouchers/VoucherExcelImportPanel";
import { useProcessConfig } from "../../../hooks/useProcessConfig";
import { ActionOtpModal } from "../../shared/ActionOtpModal";
import {
    TRANSFER_CREATE_TEXT,
    type ComponentLocale,
} from "../../../lib/i18n/componentTranslations";

type Locale = ComponentLocale;
type StepId = 0 | 1 | 2 | 3;
type TransferTypeValue = "INTRA_WAREHOUSE" | "INTER_WAREHOUSE";

interface Props {
    cloneData?: Record<string, unknown> | null;
    editData?: Record<string, unknown> | null;
    isEdit?: boolean;
    prefillWarehouseId?: string;
    onCreated: () => void;
}

interface TransferItemData {
    id: string;
    product_id: string;
    product_name: string;
    source_location_id: string;
    destination_location_id: string;
    quantity: number;
}

const TRANSFER_TYPES = [
    {
        value: "INTRA_WAREHOUSE" as TransferTypeValue,
        labelKey: "intra",
        descKey: "intraDesc",
        icon: ArrowRightLeft,
    },
    {
        value: "INTER_WAREHOUSE" as TransferTypeValue,
        labelKey: "inter",
        descKey: "interDesc",
        icon: ArrowUpRight,
    },
] as const;

const STEPS = [
    { id: 0 as StepId, icon: ClipboardList, labelKey: "info" },
    { id: 1 as StepId, icon: Upload, labelKey: "upload" },
    { id: 2 as StepId, icon: Package, labelKey: "products" },
    { id: 3 as StepId, icon: CheckCircle2, labelKey: "confirm" },
] as const;


function ProductPickerCard({
    product,
    isAdded,
    onAdd,
    totalAtp,
    copy,
}: {
    product: { id: string; name: string; code: string; unit: string; barcode?: string | null };
    isAdded: boolean;
    onAdd: () => void;
    totalAtp: number;
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
                    <p className="mt-1 text-xxs font-semibold text-[var(--color-status-completed-text)]">
                        ATP: {totalAtp}
                    </p>
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

export default function CreateTransferTab({
    cloneData,
    editData,
    isEdit,
    prefillWarehouseId,
    onCreated,
}: Props) {
    const { lang } = useTranslation();
    const locale = (lang || "vi") as Locale;
    const copy = TRANSFER_CREATE_TEXT[locale];
    const user = useUserStore((s) => s.user);
    const { warehouses, loading: warehousesLoading } = useWarehouses();
    const { products, loading: productsLoading } = useProducts();
    const [step, setStep] = useState<StepId>(0);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [productSearch, setProductSearch] = useState("");
    const [files, setFiles] = useState<SelectedFile[]>([]);
    const [transferType, setTransferType] =
        useState<TransferTypeValue>("INTER_WAREHOUSE");
    const [sourceWarehouseId, setSourceWarehouseId] = useState(
        prefillWarehouseId || "",
    );
    const [destWarehouseId, setDestWarehouseId] = useState("");
    const [notes, setNotes] = useState("");
    const [items, setItems] = useState<TransferItemData[]>([]);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const skipSourceClearForValueRef = useRef<string | null>(null);

    const isIntra = transferType === "INTRA_WAREHOUSE";

    const { config: processConfig } = useProcessConfig(
        isIntra ? "TRANSFER_INTRA" : "TRANSFER_ORDER",
        sourceWarehouseId || undefined
    );

    const sourceWarehouse = useMemo(
        () => warehouses.find((wh) => wh.id === sourceWarehouseId) ?? null,
        [warehouses, sourceWarehouseId],
    );
    const destWarehouse = useMemo(
        () => warehouses.find((wh) => wh.id === destWarehouseId) ?? null,
        [warehouses, destWarehouseId],
    );

    useEffect(() => {
        if (isIntra && sourceWarehouseId) {
            setDestWarehouseId(sourceWarehouseId);
        }
    }, [isIntra, sourceWarehouseId]);

    useEffect(() => {
        if (prefillWarehouseId) setSourceWarehouseId(prefillWarehouseId);
    }, [prefillWarehouseId]);

    useEffect(() => {
        if (!cloneData && !editData) return;
        const dataSource = editData || cloneData;

        const nextSourceWarehouseId = (dataSource?.source_warehouse_id as string) || (dataSource?.warehouse_id as string) || "";
        skipSourceClearForValueRef.current = nextSourceWarehouseId;
        setSourceWarehouseId(nextSourceWarehouseId);
        setTransferType(((dataSource?.transfer_type as string) || "INTER_WAREHOUSE") as TransferTypeValue);
        setDestWarehouseId(
            (dataSource?.destination_warehouse_id as string) || "",
        );
        setNotes((dataSource?.notes as string) || "");
        
        if (Array.isArray(dataSource?.items)) {
            setItems(
                (dataSource?.items as any[]).map((item) => ({
                    id: crypto.randomUUID(),
                    product_id: item.product_id || "",
                    product_name: item.product_name || "",
                    source_location_id: item.source_location_id || item.warehouse_location_id || "",
                    destination_location_id: item.destination_location_id || "",
                    quantity: item.expected_quantity || item.quantity || 1,
                }))
            );
        }

        if (editData && Array.isArray(editData.attachment_urls)) {
            setFiles(editData.attachment_urls.map((url: string) => {
                const name = url.split("/").pop() || "attachment";
                return {
                    id: crypto.randomUUID(),
                    file: new File([], name),
                    name,
                    size: 0,
                    type: "application/octet-stream",
                    progress: 100,
                    url,
                    error: null,
                };
            }));
        }
        
        setStep(0);
    }, [cloneData, editData]);

    useEffect(() => {
        if (skipSourceClearForValueRef.current === sourceWarehouseId) {
            skipSourceClearForValueRef.current = null;
            return;
        }
        skipSourceClearForValueRef.current = null;
        setItems([]);
    }, [sourceWarehouseId]);

    const { locations: allLocations } = useWarehouseLocations();
    const { locations: srcLocations, loading: srcLocLoading } =
        useWarehouseLocations(sourceWarehouseId || undefined);
    const {
        getLocationsForProduct,
        getAtp,
        getTotalAtpForProduct,
        loading: invLoading,
    } =
        useInventoryByWarehouse(sourceWarehouseId || undefined);
    const { locations: dstLocations, loading: dstLocLoading } =
        useWarehouseLocations(
            isIntra ? sourceWarehouseId || undefined : destWarehouseId || undefined,
        );

    const filteredProducts = useMemo(() => {
        const q = productSearch.toLowerCase();
        return products.filter((p) => {
            if (getTotalAtpForProduct(p.id) <= 0) return false;
            if (!productSearch.trim()) return true;
            return (
                p.name.toLowerCase().includes(q) ||
                p.code.toLowerCase().includes(q) ||
                (p.barcode && p.barcode.toLowerCase().includes(q))
            );
        });
    }, [products, productSearch, getTotalAtpForProduct]);

    const getAvailableSourceLocations = useCallback(
        (productId: string, currentItemId?: string) => {
            const usedLocationIds = new Set(
                items
                    .filter(
                        (item) =>
                            item.product_id === productId &&
                            item.id !== currentItemId &&
                            item.source_location_id,
                    )
                    .map((item) => item.source_location_id),
            );

            return getLocationsForProduct(productId).filter(
                (location) => !usedLocationIds.has(location.locationId),
            );
        },
        [items, getLocationsForProduct],
    );

    const selectedProductGroups = useMemo(() => {
        const groups = new Map<
            string,
            {
                product_id: string;
                product_name: string;
                product?: (typeof products)[number];
                lines: TransferItemData[];
            }
        >();

        for (const item of items) {
            const existing =
                groups.get(item.product_id) ??
                {
                    product_id: item.product_id,
                    product_name: item.product_name,
                    product: products.find((p) => p.id === item.product_id),
                    lines: [],
                };
            existing.lines.push(item);
            groups.set(item.product_id, existing);
        }

        return Array.from(groups.values());
    }, [items, products]);

    const canGoNext = useCallback((): boolean => {
        switch (step) {
            case 0:
                if (!sourceWarehouseId) return false;
                if (isIntra) return true;
                return destWarehouseId !== "" && destWarehouseId !== sourceWarehouseId;
            case 1:
                if (processConfig === null) return false;
                return processConfig?.require_evidence ? files.length > 0 : true;
            case 2:
                return (
                    items.length > 0 &&
                    items.length <= 150 &&
                    items.every((item) => {
                        if (!item.product_id || item.quantity <= 0 || !item.source_location_id) {
                            return false;
                        }
                        if (item.quantity > getAtp(item.product_id, item.source_location_id)) {
                            return false;
                        }
                        if (isIntra && !item.destination_location_id) return false;
                        if (
                            isIntra &&
                            item.source_location_id === item.destination_location_id
                        ) {
                            return false;
                        }
                        return true;
                    }) &&
                    new Set(
                        items.map(
                            (item) =>
                                `${item.product_id}:${item.source_location_id}`,
                        ),
                    ).size === items.length
                );
            default:
                return true;
        }
    }, [step, sourceWarehouseId, destWarehouseId, isIntra, items, files, processConfig, getAtp]);

    const addProduct = useCallback(
        (productId: string) => {
            const product = products.find((p) => p.id === productId);
            if (!product || items.some((item) => item.product_id === productId)) {
                return;
            }
            setItems((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    product_id: product.id,
                    product_name: product.name,
                    source_location_id:
                        getAvailableSourceLocations(productId)[0]?.locationId ?? "",
                    destination_location_id: "",
                    quantity: 1,
                },
            ]);
        },
        [products, items, getAvailableSourceLocations],
    );

    const addSourceLocationLine = useCallback(
        (productId: string) => {
            const product = products.find((p) => p.id === productId);
            const sourceLocationId =
                getAvailableSourceLocations(productId)[0]?.locationId;
            if (!product || !sourceLocationId) return;

            setItems((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    product_id: product.id,
                    product_name: product.name,
                    source_location_id: sourceLocationId,
                    destination_location_id: "",
                    quantity: 1,
                },
            ]);
        },
        [products, getAvailableSourceLocations],
    );

    const updateItem = (
        id: string,
        field: keyof TransferItemData,
        value: unknown,
    ) => {
        setItems((prev) =>
            prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)),
        );
    };

    const removeItem = (id: string) => {
        setItems((prev) => prev.filter((item) => item.id !== id));
    };

    const bulkAddItems = useCallback(
        (
            importedItems: {
                productId: string;
                quantity: number;
                unitPrice: number;
                notes: string;
                locationCode: string;
            }[]
        ) => {
            setItems((prev) => {
                const usedKeys = new Set(
                    prev
                        .filter((item) => item.source_location_id)
                        .map(
                            (item) =>
                                `${item.product_id}:${item.source_location_id}`,
                        ),
                );
                const newItems: TransferItemData[] = [];

                for (const item of importedItems) {
                    const product = products.find((p) => p.id === item.productId);
                    if (!product || getTotalAtpForProduct(item.productId) <= 0) {
                        continue;
                    }

                    // Try to resolve source location from Excel locationCode
                    let resolvedSourceLocationId = "";
                    if (item.locationCode) {
                        const code = item.locationCode.trim().toLowerCase();
                        const matched = srcLocations.find(
                            (loc) =>
                                loc.code.toLowerCase() === code ||
                                loc.name.toLowerCase() === code,
                        );
                        if (
                            matched &&
                            getAtp(item.productId, matched.id) > 0 &&
                            !usedKeys.has(`${item.productId}:${matched.id}`)
                        ) {
                            resolvedSourceLocationId = matched.id;
                        }
                    }

                    // Fallback: auto-assign from existing inventory
                    if (!resolvedSourceLocationId) {
                        resolvedSourceLocationId =
                            getLocationsForProduct(item.productId).find(
                                (location) =>
                                    !usedKeys.has(
                                        `${item.productId}:${location.locationId}`,
                                    ),
                            )?.locationId ?? "";
                    }

                    if (!resolvedSourceLocationId) continue;
                    usedKeys.add(`${item.productId}:${resolvedSourceLocationId}`);

                    newItems.push({
                        id: crypto.randomUUID(),
                        product_id: item.productId,
                        product_name: product.name,
                        source_location_id: resolvedSourceLocationId,
                        destination_location_id: "",
                        quantity: item.quantity,
                    });
                }
                return [...prev, ...newItems];
            });
        },
        [products, srcLocations, getLocationsForProduct, getAtp, getTotalAtpForProduct],
    );

    const handleSwap = () => {
        if (isIntra) return;
        const temp = sourceWarehouseId;
        setSourceWarehouseId(destWarehouseId);
        setDestWarehouseId(temp);
        setItems([]);
    };

    const handleSubmit = async () => {
        if (isSubmitting) return;

        if (processConfig?.require_evidence && files.length === 0) {
            gooeyToast.error("Bắt buộc phải tải lên chứng từ đính kèm");
            return;
        }

        if (processConfig?.require_otp) {
            setShowOtpModal(true);
            return;
        }

        executeSubmit();
    };

    const executeSubmit = async (otp?: string) => {
        if (isSubmitting) return;
        setShowConfirm(false);
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

            const payload = {
                transfer_type: transferType,
                source_warehouse_id: sourceWarehouseId,
                destination_warehouse_id: isIntra
                    ? sourceWarehouseId
                    : destWarehouseId,
                notes: notes || undefined,
                attachment_urls: uploadedUrls,
                otp,
                items: items.map((item) => ({
                    product_id: item.product_id,
                    source_location_id: item.source_location_id,
                    destination_location_id: isIntra
                        ? item.destination_location_id
                        : undefined,
                    quantity: item.quantity,
                })),
                action_time: new Date().toISOString(),
            };

            if (isEdit && editData?.id) {
                await updateTransferOrder(editData.id as string, payload);
            } else {
                await createTransferOrder(payload);
            }
        };

        const promise = submitAction();

        gooeyToast.promise(promise, {
            loading: isEdit ? "\u0110ang c\u1eadp nh\u1eadt l\u1ec7nh \u0111i\u1ec1u chuy\u1ec3n..." : (isIntra ? copy.intraLoading : copy.interLoading),
            success: isEdit ? "C\u1eadp nh\u1eadt th\u00e0nh c\u00f4ng" : (isIntra ? copy.intraSuccess : copy.interSuccess),
            error: copy.createError,
            description: {
                success: isEdit ? "L\u1ec7nh \u0111i\u1ec1u chuy\u1ec3n \u0111\u00e3 \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt." : (isIntra ? copy.intraSuccessDesc : copy.interSuccessDesc),
                error: copy.errorDesc,
            },
            action: {
                error: { label: copy.retry, onClick: () => void handleSubmit() },
            },
        });

        try {
            await promise;
            onCreated();
        } catch {
            // Toast handles error.
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="flex flex-1 h-full flex-col gap-4">
            <div className="flex w-full justify-between items-center mx-auto gap-1 overflow-x-auto py-1">
                <button
                    type="button"
                    onClick={() => step > 0 && setStep((step - 1) as StepId)}
                    disabled={step === 0}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-600 transition-all hover:bg-gray-50 disabled:opacity-30"
                >
                    <ChevronLeft size={14} />
                    {copy.back}
                </button>
                <div className="flex">
                    {STEPS.map((s, index) => {
                        const Icon = s.icon;
                        const isActive = step === s.id;
                        const isCompleted = step > s.id;
                        return (
                            <div key={s.id} className="flex items-center gap-1">
                                {index > 0 && (
                                    <div
                                        className={`h-px w-6 shrink-0 lg:w-10 ${isCompleted ? "bg-[var(--color-status-export-icon)]" : "bg-[var(--color-neutral-200)]"
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
                                        ? "bg-[var(--color-status-export-icon)] text-white shadow-sm"
                                        : isCompleted
                                            ? "bg-[var(--color-status-export-bg-muted)] text-[var(--color-status-export-text)]"
                                            : "bg-[var(--color-neutral-100)] text-[var(--color-neutral-400)]"
                                        }`}
                                >
                                    <Icon size={14} />
                                    <span className="hidden sm:inline">{copy[s.labelKey]}</span>
                                </button>
                            </div>
                        );
                    })}
                </div>
                {step < STEPS.length - 1 ? (
                    <button
                        type="button"
                        onClick={() => canGoNext() && setStep((step + 1) as StepId)}
                        disabled={!canGoNext()}
                        className="flex items-center gap-1.5 rounded-lg bg-[var(--color-status-export-icon)] px-4 py-2 text-xs font-medium text-white transition-all hover:bg-[var(--color-status-export-text)] disabled:opacity-50"
                    >
                        {copy.next}
                        <ChevronRight size={14} />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowConfirm(true)}
                        disabled={isSubmitting}
                        className={`flex items-center gap-1.5 rounded-lg px-5 py-2 text-xs font-semibold text-white transition-all disabled:opacity-50 ${isIntra
                            ? "bg-[var(--color-status-completed-icon)] hover:bg-[var(--color-status-completed-text)]"
                            : "bg-[var(--color-status-export-icon)] hover:bg-[var(--color-status-export-text)]"
                            }`}
                    >
                        {isSubmitting
                            ? copy.processing
                            : isIntra
                                ? copy.submitIntra
                                : copy.submitInter}
                    </button>
                )}
            </div>

            <div className="flex-1 flex flex-col rounded-xl">
                {step === 0 && (
                    <div className="space-y-4">
                        {/* Transfer type selector */}
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-[var(--color-text-secondary)]">
                                {copy.transferType} *
                            </label>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {TRANSFER_TYPES.map((tt) => {
                                    const TIcon = tt.icon;
                                    return (
                                        <button
                                            key={tt.value}
                                            type="button"
                                            onClick={() => {
                                                setTransferType(tt.value);
                                                setDestWarehouseId("");
                                                setItems([]);
                                            }}
                                            className={`flex items-start gap-3 rounded-[var(--radius-sm)] border-2 p-3.5 text-left transition-all ${transferType === tt.value
                                                ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)] shadow-sm"
                                                : "border-[var(--color-border-subtle)] bg-white hover:border-[var(--color-border-focus)]"
                                                }`}
                                        >
                                            <div
                                                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-xs)] ${transferType === tt.value
                                                    ? "bg-[var(--color-brand-primary)] text-white"
                                                    : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]"
                                                    }`}
                                            >
                                                <TIcon size={18} />
                                            </div>
                                            <div className="min-w-0">
                                                <p
                                                    className={`text-sm font-semibold ${transferType === tt.value
                                                        ? "text-[var(--color-brand-primary)]"
                                                        : "text-[var(--color-text-primary)]"
                                                        }`}
                                                >
                                                    {copy[tt.labelKey]}
                                                </p>
                                                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                                                    {copy[tt.descKey]}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {isIntra ? (
                            /* Intra-warehouse: Use WarehouseSelectionPanel with map */
                            <WarehouseSelectionPanel
                                warehouses={warehouses}
                                locations={allLocations}
                                selectedWarehouseId={sourceWarehouseId}
                                loading={warehousesLoading}
                                locale={locale}
                                onSelect={(warehouseId) => {
                                    setSourceWarehouseId(warehouseId);
                                    setItems([]);
                                }}
                            />
                        ) : (
                            /* Inter-warehouse: Source + Destination + Route map */
                            <div className="flex flex-col gap-3">
                                <div className="grid gap-4 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]">
                                    <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3">
                                        <div className="mb-3">
                                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                                {copy.sourceWarehouse} *
                                            </p>
                                        </div>
                                        {warehousesLoading ? (
                                            <div className="space-y-2">
                                                {Array.from({ length: 3 }).map((_, i) => (
                                                    <div key={i} className="h-16 animate-pulse rounded-[var(--radius-sm)] bg-[var(--color-surface-card)]" />
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="max-h-[200px] space-y-2 overflow-y-auto pr-1">
                                                {warehouses
                                                    .filter((wh) => wh.id !== destWarehouseId)
                                                    .map((warehouse) => {
                                                        const isSelected = warehouse.id === sourceWarehouseId;
                                                        return (
                                                            <button
                                                                key={warehouse.id}
                                                                type="button"
                                                                onClick={() => {
                                                                    setSourceWarehouseId(warehouse.id);
                                                                    setItems([]);
                                                                }}
                                                                className={`w-full rounded-[var(--radius-sm)] border p-3 text-left transition-all active:scale-[0.99] ${isSelected
                                                                    ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                                                                    : "border-[var(--color-border-subtle)] bg-white hover:border-[var(--color-border-focus)]"
                                                                    }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{warehouse.name}</p>
                                                                        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{warehouse.code}</p>
                                                                    </div>
                                                                    {isSelected && <CheckCircle2 size={18} className="shrink-0 text-[var(--color-brand-primary)]" />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        )}

                                        <div className="mt-3 border-t border-[var(--color-border-soft)] pt-3">
                                            <p className="mb-2 text-sm font-semibold text-[var(--color-text-primary)]">
                                                {copy.destinationWarehouse} *
                                            </p>
                                            <div className="max-h-[200px] space-y-2 overflow-y-auto pr-1">
                                                {warehouses
                                                    .filter((wh) => wh.id !== sourceWarehouseId)
                                                    .map((warehouse) => {
                                                        const isSelected = warehouse.id === destWarehouseId;
                                                        return (
                                                            <button
                                                                key={warehouse.id}
                                                                type="button"
                                                                onClick={() => setDestWarehouseId(warehouse.id)}
                                                                className={`w-full rounded-[var(--radius-sm)] border p-3 text-left transition-all active:scale-[0.99] ${isSelected
                                                                    ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)]"
                                                                    : "border-[var(--color-border-subtle)] bg-white hover:border-[var(--color-border-focus)]"
                                                                    }`}
                                                            >
                                                                <div className="flex items-center justify-between gap-3">
                                                                    <div className="min-w-0">
                                                                        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">{warehouse.name}</p>
                                                                        <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{warehouse.code}</p>
                                                                    </div>
                                                                    {isSelected && <CheckCircle2 size={18} className="shrink-0 text-[var(--color-brand-primary)]" />}
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                            </div>
                                        </div>

                                        {sourceWarehouseId && destWarehouseId && sourceWarehouseId === destWarehouseId && (
                                            <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-error-text)]">
                                                <AlertTriangle size={14} />
                                                <span>{copy.sameWarehouse}</span>
                                            </div>
                                        )}
                                    </section>

                                    {/* Route map */}
                                    <TransferRouteMap
                                        sourceWarehouse={sourceWarehouse}
                                        destinationWarehouse={destWarehouseId !== sourceWarehouseId ? destWarehouse : null}
                                        locale={locale}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Notes */}
                        <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
                            <label className="block">
                                <span className="mb-1 block text-sm font-semibold text-[var(--color-text-secondary)]">
                                    {copy.notes}
                                </span>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
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
                            label={copy.uploadLabel}
                            hint={copy.uploadHint}
                        />
                    </section>
                )}

                {step === 2 && (
                    <div className="flex-1 flex gap-3">
                        {/* Left column: Excel import + Product catalog */}
                        <section className="h-full flex-1 flex flex-col gap-2">
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
                                            {filteredProducts.length} {copy?.products?.toLowerCase() ?? ""}
                                        </p>
                                    </div>
                                    <div className="relative sm:w-80">
                                        <Search
                                            size={16}
                                            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
                                        />
                                        <input
                                            value={productSearch}
                                            onChange={(e) => setProductSearch(e.target.value)}
                                            placeholder={copy.searchProduct}
                                            className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] pl-9 pr-3 text-base outline-none transition-colors focus:border-[var(--color-border-focus)] lg:h-8 lg:text-sm"
                                        />
                                    </div>
                                </div>

                                {productsLoading || invLoading ? (
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
                                                isAdded={items.some((item) => item.product_id === product.id)}
                                                totalAtp={getTotalAtpForProduct(product.id)}
                                                copy={copy}
                                                onAdd={() => addProduct(product.id)}
                                            />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </section>

                        {/* Right column: Selected products */}
                        <section className="rounded-[var(--radius-md)] flex-1 flex flex-col border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
                            <div className="mb-3 flex items-center justify-between">
                                <div>
                                    <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                        {copy.selectedProducts}
                                    </h2>
                                    <p className="text-xs text-[var(--color-text-muted)]">
                                        {selectedProductGroups.length} {copy.products.toLowerCase()}
                                    </p>
                                </div>
                                <Package
                                    size={18}
                                    className="text-[var(--color-brand-primary)]"
                                />
                            </div>

                            {selectedProductGroups.length === 0 ? (
                                <div className="flex flex-1 items-center justify-center rounded-[var(--radius-sm)] border border-dashed border-[var(--color-border-subtle)] text-sm text-[var(--color-text-muted)]">
                                    {copy.emptyProducts}
                                </div>
                            ) : (
                                <div className="flex-1 h-full space-y-2 overflow-y-auto pr-1">
                                    {items.map((item, index) => {
                                        const product = products.find(
                                            (p) => p.id === item.product_id,
                                        );
                                        const group = selectedProductGroups.find(
                                            (g) => g.product_id === item.product_id,
                                        );
                                        if (!group || group.lines[0]?.id !== item.id) {
                                            return null;
                                        }
                                        const groupIndex = selectedProductGroups.findIndex(
                                            (g) => g.product_id === item.product_id,
                                        );
                                        const canAddLine =
                                            getAvailableSourceLocations(item.product_id).length > 0;
                                        const productLocations = getAvailableSourceLocations(
                                            item.product_id,
                                            item.id,
                                        );
                                        const hasLocations = productLocations.length > 0;
                                        const isLocLoading = srcLocLoading || invLoading;

                                        return (
                                            <div
                                                key={item.id}
                                                className="group rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white transition-shadow hover:shadow-sm"
                                            >
                                                {/* Card Header */}
                                                <div className="flex items-center gap-2.5 border-b border-[var(--color-border-soft)] px-3 py-2">
                                                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-[var(--color-brand-primary)] text-xxs font-bold text-white">
                                                        {groupIndex + 1}
                                                    </span>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                                                            {item.product_name}
                                                        </p>
                                                        <p className="text-xxs text-[var(--color-text-muted)]">
                                                            {product?.code} · {product?.unit}
                                                        </p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => addSourceLocationLine(item.product_id)}
                                                        disabled={!canAddLine}
                                                        className="flex h-7 shrink-0 items-center justify-center gap-1 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] px-2 text-xxs font-semibold text-[var(--color-text-secondary)] transition-all hover:border-[var(--color-border-focus)] hover:text-[var(--color-brand-primary)] disabled:opacity-40"
                                                    >
                                                        <Plus size={12} />
                                                        {copy.addLocationLine}
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            setItems((prev) =>
                                                                prev.filter(
                                                                    (line) =>
                                                                        line.product_id !== item.product_id,
                                                                ),
                                                            )
                                                        }
                                                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-error-bg)] hover:text-[var(--color-accent-error)]"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>

                                                {/* Card Body */}
                                                <div className="px-3 py-2.5">
                                                    <div
                                                        className={`grid gap-2 ${isIntra ? "sm:grid-cols-3" : "sm:grid-cols-2"
                                                            }`}
                                                    >
                                                        <label className="block">
                                                            <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
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
                                                                className="h-8 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                                                            />
                                                        </label>

                                                        <label className="block">
                                                            <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                                                {copy.sourceLocation} *
                                                            </span>
                                                            <select
                                                                value={item.source_location_id}
                                                                onChange={(e) =>
                                                                    updateItem(
                                                                        item.id,
                                                                        "source_location_id",
                                                                        e.target.value,
                                                                    )
                                                                }
                                                                disabled={
                                                                    isLocLoading ||
                                                                    !sourceWarehouseId ||
                                                                    !hasLocations
                                                                }
                                                                className={`h-8 w-full rounded-[var(--radius-xs)] border bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50 ${!hasLocations &&
                                                                    !isLocLoading &&
                                                                    sourceWarehouseId
                                                                    ? "border-[var(--color-status-pending-border)]"
                                                                    : "border-[var(--color-border-subtle)]"
                                                                    }`}
                                                            >
                                                                <option value="">
                                                                    {!sourceWarehouseId
                                                                        ? copy.selectWarehouseFirst
                                                                        : isLocLoading
                                                                            ? copy.loading
                                                                            : !hasLocations
                                                                                ? copy.noLocation
                                                                                : copy.selectLocation}
                                                                </option>
                                                                {productLocations.map((pl) => {
                                                                    const loc = srcLocations.find(
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
                                                                            / ATP: {pl.atpQty}
                                                                        </option>
                                                                    );
                                                                })}
                                                            </select>
                                                        </label>

                                                        {isIntra && (
                                                            <label className="block">
                                                                <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                                                    {copy.destinationLocation} *
                                                                </span>
                                                                <select
                                                                    value={item.destination_location_id}
                                                                    onChange={(e) =>
                                                                        updateItem(
                                                                            item.id,
                                                                            "destination_location_id",
                                                                            e.target.value,
                                                                        )
                                                                    }
                                                                    disabled={dstLocLoading || !sourceWarehouseId}
                                                                    className="h-8 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50"
                                                                >
                                                                    <option value="">
                                                                        {copy.selectDestinationLocation}
                                                                    </option>
                                                                    {dstLocations
                                                                        .filter(
                                                                            (l) => l.id !== item.source_location_id,
                                                                        )
                                                                        .map((location) => (
                                                                            <option
                                                                                key={location.id}
                                                                                value={location.id}
                                                                            >
                                                                                {location.name} ({location.code})
                                                                            </option>
                                                                        ))}
                                                                </select>
                                                                {item.source_location_id &&
                                                                    item.destination_location_id &&
                                                                    item.source_location_id ===
                                                                    item.destination_location_id && (
                                                                        <p className="mt-0.5 text-xxs text-[var(--color-error-text)]">
                                                                            {copy.sameLocation}
                                                                        </p>
                                                                    )}
                                                            </label>
                                                        )}
                                                    </div>

                                                    {item.source_location_id &&
                                                        item.quantity > 0 &&
                                                        (() => {
                                                            const atp = getAtp(
                                                                item.product_id,
                                                                item.source_location_id,
                                                            );
                                                            if (item.quantity <= atp) return null;
                                                            return (
                                                                <div className="mt-2 flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--color-warning-bg)] px-2.5 py-1.5 text-xxs text-[var(--color-warning-text)]">
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
                                                    {group.lines.slice(1).map((line) => {
                                                        const lineLocations =
                                                            getAvailableSourceLocations(
                                                                line.product_id,
                                                                line.id,
                                                            );
                                                        const lineHasLocations =
                                                            lineLocations.length > 0;
                                                        const lineAtp = line.source_location_id
                                                            ? getAtp(
                                                                  line.product_id,
                                                                  line.source_location_id,
                                                              )
                                                            : 0;

                                                        return (
                                                            <div
                                                                key={line.id}
                                                                className="mt-2 rounded-[var(--radius-xs)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-2"
                                                            >
                                                                <div
                                                                    className={`grid gap-2 ${isIntra ? "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_90px_32px]" : "sm:grid-cols-[minmax(0,1fr)_90px_32px]"}`}
                                                                >
                                                                    <label className="block">
                                                                        <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                                                            {copy.sourceLocation} *
                                                                        </span>
                                                                        <select
                                                                            value={line.source_location_id}
                                                                            onChange={(e) =>
                                                                                updateItem(
                                                                                    line.id,
                                                                                    "source_location_id",
                                                                                    e.target.value,
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                isLocLoading ||
                                                                                !sourceWarehouseId ||
                                                                                !lineHasLocations
                                                                            }
                                                                            className="h-8 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50"
                                                                        >
                                                                            <option value="">
                                                                                {!sourceWarehouseId
                                                                                    ? copy.selectWarehouseFirst
                                                                                    : isLocLoading
                                                                                      ? copy.loading
                                                                                      : !lineHasLocations
                                                                                        ? copy.noLocation
                                                                                        : copy.selectLocation}
                                                                            </option>
                                                                            {lineLocations.map((pl) => {
                                                                                const loc = srcLocations.find(
                                                                                    (l) =>
                                                                                        l.id === pl.locationId,
                                                                                );
                                                                                return (
                                                                                    <option
                                                                                        key={pl.locationId}
                                                                                        value={pl.locationId}
                                                                                    >
                                                                                        {loc
                                                                                            ? `${loc.name} (${loc.code})`
                                                                                            : pl.locationId}{" "}
                                                                                        / ATP: {pl.atpQty}
                                                                                    </option>
                                                                                );
                                                                            })}
                                                                        </select>
                                                                    </label>

                                                                    {isIntra && (
                                                                        <label className="block">
                                                                            <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                                                                {copy.destinationLocation} *
                                                                            </span>
                                                                            <select
                                                                                value={line.destination_location_id}
                                                                                onChange={(e) =>
                                                                                    updateItem(
                                                                                        line.id,
                                                                                        "destination_location_id",
                                                                                        e.target.value,
                                                                                    )
                                                                                }
                                                                                disabled={
                                                                                    dstLocLoading ||
                                                                                    !sourceWarehouseId
                                                                                }
                                                                                className="h-8 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50"
                                                                            >
                                                                                <option value="">
                                                                                    {copy.selectDestinationLocation}
                                                                                </option>
                                                                                {dstLocations
                                                                                    .filter(
                                                                                        (location) =>
                                                                                            location.id !==
                                                                                            line.source_location_id,
                                                                                    )
                                                                                    .map((location) => (
                                                                                        <option
                                                                                            key={location.id}
                                                                                            value={location.id}
                                                                                        >
                                                                                            {location.name} (
                                                                                            {location.code})
                                                                                        </option>
                                                                                    ))}
                                                                            </select>
                                                                        </label>
                                                                    )}

                                                                    <label className="block">
                                                                        <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                                                            {copy.quantity} *
                                                                        </span>
                                                                        <input
                                                                            type="number"
                                                                            value={line.quantity || ""}
                                                                            onChange={(e) =>
                                                                                updateItem(
                                                                                    line.id,
                                                                                    "quantity",
                                                                                    Number(e.target.value),
                                                                                )
                                                                            }
                                                                            min={1}
                                                                            className="h-8 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                                                                        />
                                                                    </label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => removeItem(line.id)}
                                                                        className="mt-4 flex h-8 w-7 items-center justify-center rounded-[var(--radius-xs)] text-[var(--color-text-muted)] transition-all hover:bg-[var(--color-error-bg)] hover:text-[var(--color-accent-error)]"
                                                                    >
                                                                        <Trash2 size={13} />
                                                                    </button>
                                                                </div>
                                                                {line.source_location_id &&
                                                                    line.quantity > lineAtp && (
                                                                        <div className="mt-2 flex items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--color-warning-bg)] px-2.5 py-1.5 text-xxs text-[var(--color-warning-text)]">
                                                                            <AlertTriangle
                                                                                size={12}
                                                                                className="shrink-0"
                                                                            />
                                                                            <span>
                                                                                {copy.atpWarning
                                                                                    .replace(
                                                                                        "{quantity}",
                                                                                        String(line.quantity),
                                                                                    )
                                                                                    .replace(
                                                                                        "{atp}",
                                                                                        String(lineAtp),
                                                                                    )}
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                            </div>
                                                        );
                                                    })}
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
                    <div className="space-y-4">
                        {/* Route Map (inter-warehouse only) */}
                        {!isIntra && (
                            <TransferRouteMap
                                sourceWarehouse={warehouses.find((w) => w.id === sourceWarehouseId) ?? null}
                                destinationWarehouse={warehouses.find((w) => w.id === destWarehouseId) ?? null}
                                locale={locale}
                            />
                        )}

                        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                            {/* Summary info */}
                            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
                                <div className="mb-4 flex items-center gap-2">
                                    <ClipboardList
                                        size={18}
                                        className="text-[var(--color-status-export-icon)]"
                                    />
                                    <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
                                        {copy.confirmTitle}
                                    </h2>
                                </div>

                                <div className="divide-y divide-[var(--color-border-soft)] text-sm">
                                    <div className="flex justify-between gap-4 py-3">
                                        <span className="text-[var(--color-text-muted)]">
                                            {copy.transferType}
                                        </span>
                                        <span className="text-right font-semibold text-[var(--color-text-primary)]">
                                            {isIntra ? copy.intra : copy.inter}
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-4 py-3">
                                        <span className="text-[var(--color-text-muted)]">
                                            {isIntra ? copy.executionWarehouse : copy.sourceWarehouse}
                                        </span>
                                        <span className="text-right font-semibold text-[var(--color-text-primary)]">
                                            {warehouses.find((w) => w.id === sourceWarehouseId)?.name || "-"}
                                        </span>
                                    </div>
                                    {!isIntra && (
                                        <div className="flex justify-between gap-4 py-3">
                                            <span className="text-[var(--color-text-muted)]">
                                                {copy.destinationWarehouse}
                                            </span>
                                            <span className="text-right font-semibold text-[var(--color-text-primary)]">
                                                {warehouses.find((w) => w.id === destWarehouseId)?.name || "-"}
                                            </span>
                                        </div>
                                    )}
                                    <div className="py-3">
                                        <span className="text-[var(--color-text-muted)]">
                                            {copy.notes}
                                        </span>
                                        <p className="mt-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-3 text-[var(--color-text-secondary)]">
                                            {notes || (locale === "zh" ? "无备注" : "Khong co ghi chu")}
                                        </p>
                                    </div>
                                </div>

                                {isIntra && (
                                    <div className="mt-3 rounded-[var(--radius-sm)] bg-[var(--color-status-transit-bg)] p-3 text-xs text-[var(--color-status-transit-text)]">
                                        <span className="font-semibold">{copy.noteTitle}:</span>{" "}
                                        {copy.intraNotice}
                                    </div>
                                )}
                            </div>

                            {/* Metrics sidebar */}
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
                                            {selectedProductGroups.length}
                                        </p>
                                    </div>
                                    <div className="col-span-2 rounded-[var(--radius-sm)] bg-[var(--color-status-export-bg)] p-3">
                                        <p className="text-xxs font-semibold uppercase text-[var(--color-status-export-text)]">
                                            {copy.totalQty}
                                        </p>
                                        <p className="mt-2 text-lg font-bold text-[var(--color-status-export-text)]">
                                            {items.reduce((sum, i) => sum + (i.quantity || 0), 0)}
                                        </p>
                                    </div>
                                </div>

                                {/* Items preview */}
                                {items.length > 0 && (
                                    <div className="mt-3 max-h-48 overflow-y-auto rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)]">
                                        <table className="w-full text-xs">
                                            <thead className="sticky top-0 bg-[var(--color-surface-subtle)]">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                                        {copy.products}
                                                    </th>
                                                    <th className="px-3 py-2 text-right text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                                        SL
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {items.map((item) => (
                                                    <tr key={item.id} className="border-t border-[var(--color-border-soft)]">
                                                        <td className="px-3 py-1.5 text-[var(--color-text-secondary)]">
                                                            {item.product_name}
                                                        </td>
                                                        <td className="px-3 py-1.5 text-right font-medium text-[var(--color-text-primary)]">
                                                            {item.quantity}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </aside>
                        </section>
                    </div>
                )}
            </div>

            {showConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-[500px] rounded-2xl bg-white p-4 shadow-2xl">
                        <h3 className="text-base font-bold text-gray-900">
                            {isIntra ? copy.confirmIntraTitle : copy.confirmInterTitle}
                        </h3>
                        <p className="mt-2 text-sm text-gray-500">
                            {isIntra ? copy.confirmIntraDesc : copy.confirmInterDesc}
                        </p>
                        <div className="mt-5 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowConfirm(false)}
                                className="flex-1 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition-all hover:bg-gray-50"
                            >
                                {copy.cancel}
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50 ${isIntra
                                    ? "bg-[var(--color-status-completed-icon)] hover:bg-[var(--color-status-completed-text)]"
                                    : "bg-[var(--color-status-export-icon)] hover:bg-[var(--color-status-export-text)]"
                                    }`}
                            >
                                {isSubmitting ? copy.processing : copy.confirm}
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {showOtpModal && (
                <ActionOtpModal
                    onCancel={() => setShowOtpModal(false)}
                    onConfirm={(otp: string) => {
                        executeSubmit(otp);
                    }}
                />
            )}
        </div>
    );
}
