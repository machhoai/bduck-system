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
import { WarehouseSelectionPanel } from "../import-vouchers/WarehouseSelectionPanel";
import { useInventoryByWarehouse } from "../../../hooks/useInventoryByWarehouse";
import { createExportVoucher, updateExportVoucher } from "../../../hooks/useExportVoucherApi";
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
import { VoucherExcelImportPanel } from "../import-vouchers/VoucherExcelImportPanel";
import { useProcessConfig } from "../../../hooks/useProcessConfig";
import { ActionOtpModal } from "../../shared/ActionOtpModal";
import {
    EXPORT_VOUCHER_CREATE_TEXT,
    type ComponentLocale,
} from "../../../lib/i18n/componentTranslations";

type Locale = ComponentLocale;
type StepId = 0 | 1 | 2 | 3;

interface Props {
    cloneData?: Record<string, unknown> | null;
    editData?: Record<string, unknown> | null;
    isEdit?: boolean;
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


function ProductPickerCard({
    product,
    isAdded,
    onAdd,
    totalAtp,
    copy,
}: {
    product: any;
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
                        {copy.available}: {totalAtp}
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

export default function CreateExportTab({
    cloneData,
    editData,
    isEdit,
    prefillWarehouseId,
    onCreated,
}: Props) {
    const { t, lang } = useTranslation();
    const locale = (lang || "vi") as Locale;
    const copy = EXPORT_VOUCHER_CREATE_TEXT[locale];
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
    const [showOtpModal, setShowOtpModal] = useState(false);

    const { config: processConfig } = useProcessConfig("EXPORT_VOUCHER", warehouseId || undefined);

    useEffect(() => {
        if (prefillWarehouseId) {
            setWarehouseId(prefillWarehouseId);
        }
    }, [prefillWarehouseId]);

    useEffect(() => {
        if (!cloneData && !editData) return;
        const dataSource = editData || cloneData;

        setWarehouseId((dataSource?.warehouse_id as string) || "");
        setExportType((dataSource?.export_type as string) || "TRANSFER");
        setDestinationWarehouseId(
            (dataSource?.destination_warehouse_id as string) ||
            (dataSource?.recipient_department as string) ||
            "",
        );
        setNotes((dataSource?.notes as string) || "");
        
        if (Array.isArray(dataSource?.items)) {
            setItems(
                (dataSource?.items as any[]).map((item) => ({
                    id: crypto.randomUUID(),
                    product_id: item.product_id || "",
                    product_name: item.product_name || "",
                    warehouse_location_id: item.warehouse_location_id || item.source_location_id || "",
                    quantity: item.expected_quantity || item.quantity || 1,
                    unit_price: item.unit_price || 0,
                    notes: item.notes || "",
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

    const { locations: allLocations } = useWarehouseLocations();
    const { locations, loading: locationsLoading } = useWarehouseLocations(
        warehouseId || undefined,
    );
    const {
        getLocationsForProduct,
        getAtp,
        getTotalAtpForProduct,
        loading: inventoryLoading,
    } =
        useInventoryByWarehouse(warehouseId || undefined);

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

    const getAvailableProductLocations = useCallback(
        (productId: string, currentItemId?: string) => {
            const usedLocationIds = new Set(
                items
                    .filter(
                        (item) =>
                            item.product_id === productId &&
                            item.id !== currentItemId &&
                            item.warehouse_location_id,
                    )
                    .map((item) => item.warehouse_location_id),
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
                lines: ExportItemData[];
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
                if (processConfig === null) return false;
                return processConfig?.require_evidence ? files.length > 0 : true;
            case 2:
                return (
                    items.length > 0 &&
                    items.every((item) => {
                        if (
                            item.product_id === "" ||
                            item.quantity <= 0 ||
                            item.warehouse_location_id === ""
                        ) {
                            return false;
                        }
                        return (
                            item.quantity <=
                            getAtp(item.product_id, item.warehouse_location_id)
                        );
                    }) &&
                    new Set(
                        items.map(
                            (item) =>
                                `${item.product_id}:${item.warehouse_location_id}`,
                        ),
                    ).size === items.length
                );
            default:
                return true;
        }
    }, [step, warehouseId, exportType, destinationWarehouseId, notes, items, files, processConfig, getAtp]);

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
                    warehouse_location_id:
                        getAvailableProductLocations(productId)[0]?.locationId ?? "",
                    quantity: 1,
                    unit_price: 0,
                    notes: "",
                },
            ]);
        },
        [products, items, getAvailableProductLocations],
    );

    const addLocationLine = useCallback(
        (productId: string) => {
            const product = products.find((p) => p.id === productId);
            const locationId = getAvailableProductLocations(productId)[0]?.locationId;
            if (!product || !locationId) return;

            setItems((prev) => [
                ...prev,
                {
                    id: crypto.randomUUID(),
                    product_id: product.id,
                    product_name: product.name,
                    warehouse_location_id: locationId,
                    quantity: 1,
                    unit_price: 0,
                    notes: "",
                },
            ]);
        },
        [products, getAvailableProductLocations],
    );

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
                        .filter((item) => item.warehouse_location_id)
                        .map(
                            (item) =>
                                `${item.product_id}:${item.warehouse_location_id}`,
                        ),
                );
                const newItems: ExportItemData[] = [];

                for (const item of importedItems) {
                    const product = products.find((p) => p.id === item.productId);
                    if (!product || getTotalAtpForProduct(item.productId) <= 0) {
                        continue;
                    }

                    // Try to resolve location from Excel locationCode
                    let resolvedLocationId = "";
                    if (item.locationCode) {
                        const code = item.locationCode.trim().toLowerCase();
                        const matched = locations.find(
                            (loc) =>
                                loc.code.toLowerCase() === code ||
                                loc.name.toLowerCase() === code,
                        );
                        if (
                            matched &&
                            getAtp(item.productId, matched.id) > 0 &&
                            !usedKeys.has(`${item.productId}:${matched.id}`)
                        ) {
                            resolvedLocationId = matched.id;
                        }
                    }

                    // Fallback: auto-assign from existing inventory
                    if (!resolvedLocationId) {
                        resolvedLocationId =
                            getLocationsForProduct(item.productId).find(
                                (location) =>
                                    !usedKeys.has(
                                        `${item.productId}:${location.locationId}`,
                                    ),
                            )?.locationId ?? "";
                    }

                    if (!resolvedLocationId) continue;
                    usedKeys.add(`${item.productId}:${resolvedLocationId}`);

                    newItems.push({
                        id: crypto.randomUUID(),
                        product_id: item.productId,
                        product_name: product.name,
                        warehouse_location_id: resolvedLocationId,
                        quantity: item.quantity,
                        unit_price: item.unitPrice,
                        notes: item.notes,
                    });
                }
                return [...prev, ...newItems];
            });
        },
        [products, locations, getLocationsForProduct, getAtp, getTotalAtpForProduct],
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

        if (processConfig?.require_evidence && files.length === 0) {
            gooeyToast.error(exportText?.form?.requireEvidence ?? "Bắt buộc phải tải lên chứng từ đính kèm");
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
                otp,
                items: items.map((item) => ({
                    product_id: item.product_id,
                    warehouse_location_id: item.warehouse_location_id,
                    quantity: item.quantity,
                    unit_price: item.unit_price,
                    notes: item.notes || undefined,
                })),
                action_time: new Date().toISOString(),
            };

            if (isEdit && editData?.id) {
                await updateExportVoucher(editData.id as string, payload);
            } else {
                await createExportVoucher(payload);
            }
        };

        const promise = submitAction();
        
        gooeyToast.promise(promise, {
            loading: isEdit ? "\u0110ang c\u1eadp nh\u1eadt phi\u1ebfu xu\u1ea5t kho..." : exportText.toast.creating,
            success: isEdit ? "C\u1eadp nh\u1eadt th\u00e0nh c\u00f4ng" : exportText.toast.createSuccess,
            error: exportText.toast.createError,
            description: {
                success: isEdit ? "Phi\u1ebfu xu\u1ea5t kho \u0111\u00e3 \u0111\u01b0\u1ee3c c\u1eadp nh\u1eadt." : exportText.toast.createSuccessDesc,
                error: exportText.toast.createErrorDesc,
            },
            action: {
                error: { label: t.common.retry, onClick: () => void handleSubmit() },
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
                    {copy.back}
                </button>

                <div className="flex">
                    {STEPS.map((s, idx) => {
                        const Icon = s.icon;
                        const isActive = step === s.id;
                        const isCompleted = step > s.id;
                        return (
                            <div key={s.id} className="flex items-center gap-1">
                                {idx > 0 && (
                                    <div
                                        className={`h-px w-6 shrink-0 lg:w-10 ${isCompleted ? "bg-[var(--color-brand-primary)]" : "bg-[var(--color-neutral-200)]"
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
                                        ? "bg-[var(--color-brand-primary)] text-white shadow-sm"
                                        : isCompleted
                                            ? "bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]"
                                            : "bg-[var(--color-surface-card)] text-[var(--color-text-muted)]"
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
                        onClick={goNext}
                        disabled={!canGoNext()}
                        className="flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-xs font-medium text-white transition-all hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50"
                    >
                        {copy.next}
                        <ChevronRight size={16} />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        className="flex items-center gap-1.5 rounded-lg bg-[var(--color-brand-primary)] px-5 py-2 text-xs font-semibold text-white transition-all hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50"
                    >
                        {isSubmitting ? copy.submitting : copy.submit}
                    </button>
                )}
            </div>

            <div className="flex-1 flex flex-col rounded-xl">
                {step === 0 && (
                    <div className="space-y-4">
                        {/* Export type selector */}
                        <div>
                            <label className="mb-1.5 block text-sm font-semibold text-[var(--color-text-secondary)]">
                                {copy.exportType} *
                            </label>
                            <div className="grid gap-2 sm:grid-cols-2">
                                {EXPORT_TYPES.map((et) => (
                                    <button
                                        key={et.value}
                                        type="button"
                                        onClick={() => {
                                            setExportType(et.value);
                                            setDestinationWarehouseId("");
                                        }}
                                        className={`flex items-center gap-3 rounded-[var(--radius-sm)] border-2 p-3.5 text-left transition-all ${exportType === et.value
                                            ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)] shadow-sm"
                                            : "border-[var(--color-border-subtle)] bg-white hover:border-[var(--color-border-focus)]"
                                            }`}
                                    >
                                        <p className={`text-sm font-semibold ${exportType === et.value
                                            ? "text-[var(--color-brand-primary)]"
                                            : "text-[var(--color-text-primary)]"
                                            }`}>
                                            {copy[et.labelKey]}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {exportType === "ADJUSTMENT" ? (
                            /* Adjustment: Single warehouse selection with map */
                            <WarehouseSelectionPanel
                                warehouses={warehouses}
                                locations={allLocations}
                                selectedWarehouseId={warehouseId}
                                loading={warehousesLoading}
                                locale={locale}
                                onSelect={(id) => setWarehouseId(id)}
                            />
                        ) : (
                            /* Transfer: Source warehouse with map + destination selector */
                            <div className="space-y-3">
                                <WarehouseSelectionPanel
                                    warehouses={warehouses}
                                    locations={allLocations}
                                    selectedWarehouseId={warehouseId}
                                    loading={warehousesLoading}
                                    locale={locale}
                                    onSelect={(id) => setWarehouseId(id)}
                                />

                                <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
                                    <label className="block">
                                        <span className="mb-1 block text-sm font-semibold text-[var(--color-text-secondary)]">
                                            {copy.destinationWarehouse} *
                                        </span>
                                        <select
                                            value={destinationWarehouseId}
                                            onChange={(e) => setDestinationWarehouseId(e.target.value)}
                                            disabled={warehousesLoading}
                                            className="h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-3 text-base text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)] lg:h-8 lg:text-sm disabled:opacity-50"
                                        >
                                            <option value="">
                                                {warehousesLoading ? copy.loading : copy.chooseDestination}
                                            </option>
                                            {warehouses
                                                .filter((wh) => wh.id !== warehouseId)
                                                .map((wh) => (
                                                    <option key={wh.id} value={wh.id}>
                                                        {wh.name} ({wh.code})
                                                    </option>
                                                ))}
                                        </select>
                                    </label>
                                    {warehouseId && destinationWarehouseId && warehouseId === destinationWarehouseId && (
                                        <div className="mt-2 flex items-center gap-1.5 text-xs text-[var(--color-error-text)]">
                                            <AlertTriangle size={14} />
                                            <span>{copy.sameWarehouse}</span>
                                        </div>
                                    )}
                                </section>
                            </div>
                        )}

                        {/* Notes / Adjustment reason */}
                        <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4">
                            <label className="block">
                                <span className="mb-1 block text-sm font-semibold text-[var(--color-text-secondary)]">
                                    {exportType === "ADJUSTMENT" ? `${copy.adjustmentReason} *` : copy.notes}
                                </span>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={3}
                                    placeholder={exportType === "ADJUSTMENT" ? copy.reasonPlaceholder : copy.notesPlaceholder}
                                    className={`w-full resize-none rounded-[var(--radius-sm)] border bg-[var(--color-surface-input)] px-3 py-3 text-base text-[var(--color-text-primary)] outline-none transition-colors focus:border-[var(--color-border-focus)] lg:text-sm ${
                                        exportType === "ADJUSTMENT" && notes.trim().length === 0
                                            ? "border-[var(--color-error-border)]"
                                            : "border-[var(--color-border-subtle)]"
                                    }`}
                                />
                                {exportType === "ADJUSTMENT" && notes.trim().length === 0 && (
                                    <p className="mt-1 text-xs text-[var(--color-error-text)]">
                                        {copy.reasonRequired}
                                    </p>
                                )}
                            </label>
                        </section>
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

                                {productsLoading || inventoryLoading ? (
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
                                            getAvailableProductLocations(item.product_id).length > 0;
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
                                                        onClick={() => addLocationLine(item.product_id)}
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
                                                    <div className="grid gap-2 grid-cols-2 lg:grid-cols-3">
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
                                                                className="h-8 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)]"
                                                            />
                                                        </label>
                                                        <label className="block">
                                                            <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                                                {copy.location} *
                                                            </span>
                                                            {(() => {
                                                                const productLocations = getAvailableProductLocations(
                                                                    item.product_id,
                                                                    item.id,
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
                                                                        className={`h-8 w-full rounded-[var(--radius-xs)] border bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50 ${!hasLocations && !isLoading && warehouseId
                                                                            ? "border-[var(--color-status-pending-border)]"
                                                                            : "border-[var(--color-border-subtle)]"
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
                                                        const productLocations =
                                                            getAvailableProductLocations(
                                                                line.product_id,
                                                                line.id,
                                                            );
                                                        const hasLocations =
                                                            productLocations.length > 0;
                                                        const isLoading =
                                                            locationsLoading || inventoryLoading;
                                                        const atp = line.warehouse_location_id
                                                            ? getAtp(
                                                                  line.product_id,
                                                                  line.warehouse_location_id,
                                                              )
                                                            : 0;

                                                        return (
                                                            <div
                                                                key={line.id}
                                                                className="mt-2 rounded-[var(--radius-xs)] border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-2"
                                                            >
                                                                <div className="grid gap-2 grid-cols-2 lg:grid-cols-[minmax(0,1fr)_96px_96px_32px]">
                                                                    <label className="block">
                                                                        <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                                                            {copy.location} *
                                                                        </span>
                                                                        <select
                                                                            value={line.warehouse_location_id}
                                                                            onChange={(e) =>
                                                                                updateItem(
                                                                                    line.id,
                                                                                    "warehouse_location_id",
                                                                                    e.target.value,
                                                                                )
                                                                            }
                                                                            disabled={
                                                                                isLoading ||
                                                                                !warehouseId ||
                                                                                !hasLocations
                                                                            }
                                                                            className="h-8 w-full rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-sm outline-none focus:border-[var(--color-border-focus)] disabled:opacity-50"
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
                                                                                        / {copy.available}:{" "}
                                                                                        {pl.atpQty}
                                                                                    </option>
                                                                                );
                                                                            })}
                                                                        </select>
                                                                    </label>
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
                                                                    <label className="block">
                                                                        <span className="mb-0.5 block text-xxs font-semibold uppercase text-[var(--color-text-muted)]">
                                                                            {copy.unitPrice}
                                                                        </span>
                                                                        <input
                                                                            type="number"
                                                                            value={line.unit_price || ""}
                                                                            onChange={(e) =>
                                                                                updateItem(
                                                                                    line.id,
                                                                                    "unit_price",
                                                                                    Number(e.target.value),
                                                                                )
                                                                            }
                                                                            min={0}
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
                                                                {line.warehouse_location_id &&
                                                                    line.quantity > atp && (
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
                                                                                        String(atp),
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
                                    {selectedProductGroups.length} {copy.itemCount}
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


            {showOtpModal && (
                <ActionOtpModal
                    onCancel={() => setShowOtpModal(false)}
                    onConfirm={(otp: string) => {
                        executeSubmit(otp);
                    }}
                    isSubmitting={isSubmitting}
                />
            )}
        </div>
    );
}
