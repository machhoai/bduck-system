"use client";

/**
 * QuickLocationAssign — Batch location assignment strategies
 * ─────────────────────────────────────────────
 * Toolbar nhỏ gọn cho phép phân location hàng loạt
 * cho các sản phẩm chưa có location.
 *
 * 4 chiến lược:
 * 1. Gán tất cả một vị trí
 * 2. Theo loại sản phẩm
 * 3. Mã SKU chẵn/lẻ
 * 4. Tự động theo tồn kho
 */

import { useState, useCallback, useMemo } from "react";
import { MapPin, Wand2, ChevronDown, Zap } from "lucide-react";
import type { Product, WarehouseLocation } from "@bduck/shared-types";
import { ProductType } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { QUICK_LOCATION_ASSIGN_TEXT } from "@/lib/i18n/componentTranslations";

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type Strategy = "all-one" | "by-type" | "even-odd" | "by-stock";

interface VoucherItemRef {
    id: string;
    product_id: string;
    warehouse_location_id: string;
}

interface QuickLocationAssignProps {
    items: VoucherItemRef[];
    products: Product[];
    locations: WarehouseLocation[];
    /** Get the location with highest ATP for a product */
    getBestLocation: (productId: string) => string | null;
    onAssign: (assignments: Map<string, string>) => void;
    disabled?: boolean;
}

const STRATEGY_OPTIONS: {
    id: Strategy;
    icon: typeof MapPin;
}[] = [
    {
        id: "all-one",
        icon: MapPin,
    },
    {
        id: "by-type",
        icon: Wand2,
    },
    {
        id: "even-odd",
        icon: Zap,
    },
    {
        id: "by-stock",
        icon: Wand2,
    },
];

function LocationSelect({
    value,
    onChange,
    locations,
    placeholder,
    className,
}: {
    value: string;
    onChange: (v: string) => void;
    locations: WarehouseLocation[];
    placeholder: string;
    className?: string;
}) {
    return (
        <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`h-8 rounded-[var(--radius-xs)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-input)] px-2 text-xs outline-none focus:border-[var(--color-border-focus)] ${className || ""}`}
        >
            <option value="">{placeholder}</option>
            {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                </option>
            ))}
        </select>
    );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export function QuickLocationAssign({
    items,
    products,
    locations,
    getBestLocation,
    onAssign,
    disabled,
}: QuickLocationAssignProps) {
    const { lang } = useTranslation();
    const copy = QUICK_LOCATION_ASSIGN_TEXT[lang === "zh" ? "zh" : "vi"];
    const [isOpen, setIsOpen] = useState(false);
    const [strategy, setStrategy] = useState<Strategy>("all-one");

    // Strategy-specific state
    const [allOneLocationId, setAllOneLocationId] = useState("");
    const [typeMap, setTypeMap] = useState<Record<string, string>>({
        [ProductType.EQUIPMENT]: "",
        [ProductType.SOUVENIR_SALE]: "",
        [ProductType.SOUVENIR_GIFT]: "",
    });
    const [evenLocationId, setEvenLocationId] = useState("");
    const [oddLocationId, setOddLocationId] = useState("");

    const unassignedCount = useMemo(
        () => items.filter((item) => !item.warehouse_location_id).length,
        [items],
    );

    const productMap = useMemo(() => {
        const map = new Map<string, Product>();
        for (const p of products) map.set(p.id, p);
        return map;
    }, [products]);

    const handleApply = useCallback(() => {
        const assignments = new Map<string, string>();

        for (const item of items) {
            // Skip items that already have a location
            if (item.warehouse_location_id) continue;

            const product = productMap.get(item.product_id);
            if (!product) continue;

            let locationId = "";

            switch (strategy) {
                case "all-one":
                    locationId = allOneLocationId;
                    break;

                case "by-type":
                    locationId = typeMap[product.product_type] || "";
                    break;

                case "even-odd": {
                    // Get last digit of product code
                    const lastChar = product.code.replace(/\D/g, "").slice(-1);
                    const lastDigit = parseInt(lastChar, 10);
                    if (!isNaN(lastDigit)) {
                        locationId = lastDigit % 2 === 0 ? evenLocationId : oddLocationId;
                    }
                    break;
                }

                case "by-stock":
                    locationId = getBestLocation(item.product_id) || "";
                    break;
            }

            if (locationId) {
                assignments.set(item.id, locationId);
            }
        }

        if (assignments.size > 0) {
            onAssign(assignments);
        }
        setIsOpen(false);
    }, [items, strategy, allOneLocationId, typeMap, evenLocationId, oddLocationId, productMap, getBestLocation, onAssign]);

    const canApply = useMemo(() => {
        if (unassignedCount === 0) return false;
        switch (strategy) {
            case "all-one":
                return !!allOneLocationId;
            case "by-type":
                return Object.values(typeMap).some(Boolean);
            case "even-odd":
                return !!evenLocationId || !!oddLocationId;
            case "by-stock":
                return true;
            default:
                return false;
        }
    }, [strategy, allOneLocationId, typeMap, evenLocationId, oddLocationId, unassignedCount]);

    if (items.length === 0 || locations.length === 0) return null;

    const selectedStrategy = STRATEGY_OPTIONS.find((s) => s.id === strategy);

    return (
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-status-intra-border)] bg-gradient-to-r from-[var(--color-status-intra-bg)] to-[var(--color-status-approved-bg)]">
            {/* Toggle header */}
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                disabled={disabled}
                className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/50 disabled:opacity-50"
            >
                <div className="flex h-5 w-5 items-center justify-center rounded bg-[var(--color-status-intra-icon)] text-white">
                    <Wand2 size={11} />
                </div>
                <span className="flex-1 text-xs font-semibold text-[var(--color-status-intra-text)]">
                    {copy.title}
                </span>
                {unassignedCount > 0 && (
                    <span className="rounded-full bg-[var(--color-status-pending-bg-muted)] px-1.5 py-0.5 text-xxs font-bold text-[var(--color-status-pending-text)]">
                        {unassignedCount} {copy.unassigned}
                    </span>
                )}
                <ChevronDown
                    size={14}
                    className={`text-[var(--color-status-intra-icon)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {/* Panel body */}
            {isOpen && (
                <div className="space-y-3 border-t border-[var(--color-status-intra-border)] px-3 py-3">
                    {/* Strategy selector */}
                    <div className="flex flex-wrap gap-1.5">
                        {STRATEGY_OPTIONS.map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                onClick={() => setStrategy(opt.id)}
                                className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xxs font-semibold transition-all ${
                                    strategy === opt.id
                                        ? "bg-[var(--color-status-intra-icon)] text-white shadow-sm"
                                        : "bg-white text-[var(--color-status-intra-text)] hover:bg-[var(--color-status-intra-bg)]"
                                }`}
                            >
                                {copy.strategies[opt.id].label}
                            </button>
                        ))}
                    </div>

                    {/* Strategy description */}
                    {selectedStrategy && (
                        <p className="text-xxs text-[var(--color-status-intra-text)]">
                            {copy.strategies[selectedStrategy.id].description}
                        </p>
                    )}

                    {/* Strategy-specific controls */}
                    <div className="space-y-2">
                        {strategy === "all-one" && (
                            <LocationSelect
                                value={allOneLocationId}
                                onChange={setAllOneLocationId}
                                locations={locations}
                                placeholder={copy.chooseLocation}
                                className="w-full"
                            />
                        )}

                        {strategy === "by-type" && (
                            <div className="grid gap-2 sm:grid-cols-3">
                                {Object.entries(copy.productTypes).map(([type, label]) => (
                                    <label key={type} className="block">
                                        <span className="mb-1 block text-xxs font-semibold text-[var(--color-status-intra-text)]">
                                            {label}
                                        </span>
                                        <LocationSelect
                                            value={typeMap[type] || ""}
                                            onChange={(v) =>
                                                setTypeMap((prev) => ({ ...prev, [type]: v }))
                                            }
                                            locations={locations}
                                            placeholder={copy.choose}
                                            className="w-full"
                                        />
                                    </label>
                                ))}
                            </div>
                        )}

                        {strategy === "even-odd" && (
                            <div className="grid grid-cols-2 gap-2">
                                <label className="block">
                                    <span className="mb-1 block text-xxs font-semibold text-[var(--color-status-intra-text)]">
                                        {copy.evenCode}
                                    </span>
                                    <LocationSelect
                                        value={evenLocationId}
                                        onChange={setEvenLocationId}
                                        locations={locations}
                                        placeholder={copy.locationA}
                                        className="w-full"
                                    />
                                </label>
                                <label className="block">
                                    <span className="mb-1 block text-xxs font-semibold text-[var(--color-status-intra-text)]">
                                        {copy.oddCode}
                                    </span>
                                    <LocationSelect
                                        value={oddLocationId}
                                        onChange={setOddLocationId}
                                        locations={locations}
                                        placeholder={copy.locationB}
                                        className="w-full"
                                    />
                                </label>
                            </div>
                        )}

                        {strategy === "by-stock" && (
                            <p className="rounded-[var(--radius-xs)] bg-white/80 px-2.5 py-2 text-xs text-[var(--color-status-intra-text)]">
                                {copy.stockHint}
                            </p>
                        )}
                    </div>

                    {/* Apply button */}
                    <div className="flex justify-end">
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={!canApply || disabled}
                            className="flex h-7 items-center gap-1.5 rounded-[var(--radius-xs)] bg-[var(--color-status-intra-icon)] px-3 text-xs font-semibold text-white transition-all hover:bg-[var(--color-status-intra-text)] active:scale-[0.98] disabled:opacity-40"
                        >
                            <Zap size={12} />
                            {copy.apply}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
