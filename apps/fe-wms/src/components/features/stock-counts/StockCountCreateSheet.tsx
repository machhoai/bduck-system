"use client";

import { useEffect, useMemo, useState } from "react";
import { Boxes, Layers3, MapPin, PackageSearch, Warehouse, X, Check } from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { Product, ProductCategory, Warehouse as WarehouseType, WarehouseLocation } from "@bduck/shared-types";
import { BottomSheet } from "@/components/ui/BottomSheet";
import type { CreateStockCountPayload, StockCountScope } from "@/api/stockCountApi";

const scopeOptions: Array<{ value: StockCountScope; icon: typeof Warehouse }> = [
    { value: "WAREHOUSE", icon: Warehouse },
    { value: "LOCATION", icon: MapPin },
    { value: "CATEGORY", icon: Layers3 },
    { value: "PRODUCT", icon: PackageSearch },
];

interface StockCountCreateSheetProps {
    isOpen: boolean;
    lang: "vi" | "zh";
    warehouses: WarehouseType[];
    locations: WarehouseLocation[];
    products: Product[];
    categories: ProductCategory[];
    defaultWarehouseId?: string;
    isSubmitting: boolean;
    onWarehouseChange: (warehouseId: string) => void;
    onClose: () => void;
    onSubmit: (payload: CreateStockCountPayload) => void;
}

export function StockCountCreateSheet({
    isOpen,
    lang,
    warehouses,
    locations,
    products,
    categories,
    defaultWarehouseId = "",
    isSubmitting,
    onWarehouseChange,
    onClose,
    onSubmit,
}: StockCountCreateSheetProps) {
    const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
    const [scope, setScope] = useState<StockCountScope>("PRODUCT");
    const [locationIds, setLocationIds] = useState<string[]>([]);
    const [productIds, setProductIds] = useState<string[]>([]);
    const [categoryId, setCategoryId] = useState("");
    const [notes, setNotes] = useState("");
    const [query, setQuery] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        setWarehouseId(defaultWarehouseId);
    }, [defaultWarehouseId, isOpen]);

    const { t } = useTranslation();
    const text = t.stockCount.createSheet;

    const filteredProducts = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (scope !== "PRODUCT") return [];
        return products
            .filter((product) => !q || [product.code, product.barcode, product.name].some((v) => String(v || "").toLowerCase().includes(q)))
            .slice(0, 24);
    }, [products, query, scope]);

    const filteredLocations = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (scope !== "LOCATION") return [];
        return locations
            .filter((location) => !warehouseId || location.warehouse_id === warehouseId)
            .filter((location) => !q || [location.code, location.name].some((v) => String(v || "").toLowerCase().includes(q)))
            .slice(0, 32);
    }, [locations, query, scope, warehouseId]);

    const toggleValue = (value: string, current: string[], setter: (next: string[]) => void) => {
        setter(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    };

    const handleWarehouseChange = (value: string) => {
        setWarehouseId(value);
        setLocationIds([]);
        onWarehouseChange(value);
    };

    const submit = () => {
        onSubmit({
            warehouse_id: warehouseId,
            count_scope: scope,
            warehouse_location_ids: scope === "LOCATION" ? locationIds : [],
            product_ids: scope === "PRODUCT" ? productIds : [],
            category_id: scope === "CATEGORY" ? categoryId : null,
            notes: notes.trim() || null,
            blind_count_enabled: false,
            action_time: new Date().toISOString(),
        });
    };

    const content = (
        <div className="flex flex-col gap-2.5">
            <label className="grid gap-1">
                <span className="text-xxs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{t.stockCount.warehouse}</span>
                <select
                    value={warehouseId}
                    onChange={(event) => handleWarehouseChange(event.target.value)}
                    className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-2.5 text-xs outline-none focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] transition-all shadow-sm"
                >
                    <option value="">{text.selectWarehouse}</option>
                    {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>{warehouse.code} - {warehouse.name}</option>
                    ))}
                </select>
            </label>

            <div className="grid gap-1">
                <span className="text-xxs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{text.criteria}</span>
                <div className="grid grid-cols-2 gap-2">
                    {scopeOptions.map((option) => {
                        const Icon = option.icon;
                        const active = scope === option.value;
                        return (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    setScope(option.value);
                                    setQuery("");
                                }}
                                className={`flex h-10 items-center gap-2 rounded-[var(--radius-md)] border px-3 text-left text-xs font-semibold transition-all duration-200 cursor-pointer shadow-sm ${active
                                        ? "border-[var(--color-brand-primary)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)] shadow-[var(--color-brand-primary-muted)]"
                                        : "border-[var(--color-border-subtle)] bg-white text-[var(--color-text-secondary)] hover:bg-[var(--color-neutral-50)]"
                                    }`}
                            >
                                <Icon className="h-4 w-4 shrink-0 opacity-80" />
                                <span>{t.stockCount.scopes[option.value]}</span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {scope === "PRODUCT" && (
                <div className="grid gap-2">
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={text.searchProduct}
                        className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-2.5 text-xs outline-none focus:border-[var(--color-border-focus)] focus:bg-white transition-all shadow-sm"
                    />
                    <div className="grid max-h-40 gap-1 overflow-y-auto pr-1 border border-[var(--color-border-soft)] rounded-[var(--radius-md)] p-1 bg-white shadow-inner">
                        {filteredProducts.map((product) => {
                            const selected = productIds.includes(product.id);
                            return (
                                <button
                                    key={product.id}
                                    type="button"
                                    onClick={() => toggleValue(product.id, productIds, setProductIds)}
                                    className={`rounded-[var(--radius-sm)] px-2.5 py-1 text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${selected
                                            ? "bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)] font-semibold"
                                            : "hover:bg-[var(--color-neutral-50)] text-[var(--color-text-secondary)]"
                                        }`}
                                >
                                    <span className="truncate">{product.code} - {product.name}</span>
                                    {selected && <Check className="h-3.5 w-3.5 shrink-0 ml-1" />}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-micro font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{text.selected}: {productIds.length}</p>
                </div>
            )}

            {scope === "LOCATION" && (
                <div className="grid gap-2">
                    <input
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        placeholder={text.searchLocation}
                        className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-2.5 text-xs outline-none focus:border-[var(--color-border-focus)] focus:bg-white transition-all shadow-sm"
                    />
                    <div className="grid max-h-40 gap-1 overflow-y-auto pr-1 border border-[var(--color-border-soft)] rounded-[var(--radius-md)] p-1 bg-white shadow-inner">
                        {filteredLocations.map((location) => {
                            const selected = locationIds.includes(location.id);
                            return (
                                <button
                                    key={location.id}
                                    type="button"
                                    onClick={() => toggleValue(location.id, locationIds, setLocationIds)}
                                    className={`rounded-[var(--radius-sm)] px-2.5 py-1 text-left text-xs transition-colors flex items-center justify-between cursor-pointer ${selected
                                            ? "bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)] font-semibold"
                                            : "hover:bg-[var(--color-neutral-50)] text-[var(--color-text-secondary)]"
                                        }`}
                                >
                                    <span className="truncate">{location.code} - {location.name}</span>
                                    {selected && <Check className="h-3.5 w-3.5 shrink-0 ml-1" />}
                                </button>
                            );
                        })}
                    </div>
                    <p className="text-micro font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{text.selected}: {locationIds.length}</p>
                </div>
            )}

            {scope === "CATEGORY" && (
                <label className="grid gap-1">
                    <span className="text-xxs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{text.category}</span>
                    <select
                        value={categoryId}
                        onChange={(event) => setCategoryId(event.target.value)}
                        className="h-8 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-2.5 text-xs outline-none focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] transition-all shadow-sm"
                    >
                        <option value="">{text.category}</option>
                        {categories.map((category) => (
                            <option key={category.id} value={category.id}>{category.code} - {category.name}</option>
                        ))}
                    </select>
                </label>
            )}

            <label className="grid gap-1">
                <span className="text-xxs font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{text.notes}</span>
                <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    placeholder={text.notesPlaceholder}
                    rows={2}
                    className="rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-2.5 py-1.5 text-xs outline-none focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-border-focus)] transition-all shadow-sm"
                />
            </label>

            <button
                type="button"
                onClick={submit}
                disabled={isSubmitting || !warehouseId}
                className="flex h-8 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] px-3 text-sm font-bold text-white transition-all duration-200 disabled:opacity-50 hover:bg-[var(--color-brand-primary-hover)] active:scale-[0.98] cursor-pointer w-fit self-end mt-1 shadow-sm"
            >
                <Boxes className="h-4 w-4" />
                {text.create}
            </button>
        </div>
    );

    return (
        <>
            {/* Desktop Modal Dialog */}
            {isOpen && (
                <div className="fixed inset-0 z-50 hidden items-center justify-center bg-black/40 p-4 backdrop-blur-[2px] lg:flex">
                    <div className="flex max-h-[90vh] w-[500px] flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-white shadow-2xl animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b border-[var(--color-border-soft)] px-4 py-3">
                            <div>
                                <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--color-text-muted)]">{text.criteria}</p>
                                <h2 className="text-sm font-bold text-[var(--color-text-primary)] mt-0.5">{text.title}</h2>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-[var(--radius-sm)] p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-neutral-100)] transition-colors cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        {/* Form Container */}
                        <div className="flex-1 overflow-y-auto p-4 bg-[var(--color-neutral-50)]">
                            <div className="rounded-[var(--radius-md)] border border-[var(--color-border-soft)] bg-white p-4 shadow-sm">
                                {content}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Mobile Bottom Sheet */}
            <BottomSheet title={text.title} isOpen={isOpen} onClose={onClose} defaultSnap="full">
                <div className="py-2">{content}</div>
            </BottomSheet>
        </>
    );
}
