"use client";

/**
 * WarehouseSelector — Dropdown chọn cửa hàng cho dashboard
 *
 * ► Hiển thị "Tất cả cửa hàng" + danh sách cửa hàng user có quyền
 * ► Danh sách đầu vào đã được useStores giới hạn theo WarehouseType.STORE
 */

import { ChevronDown, Warehouse as WarehouseIcon } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Warehouse } from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";

interface WarehouseSelectorProps {
    warehouses: Warehouse[];
    selectedId: string | undefined;
    onSelect: (id: string | undefined) => void;
}

export default function WarehouseSelector({
    warehouses,
    selectedId,
    onSelect,
}: WarehouseSelectorProps) {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const selected = warehouses.find((w) => w.id === selectedId);
    const label = selected?.name || t.inventoryDashboard.allWarehouses;

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target as Node)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div ref={dropdownRef} className="relative">
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(!isOpen)}
                className="flex h-8 items-center gap-1.5 rounded-full border border-white/20 bg-white/12 px-2.5 text-xs text-white/80 backdrop-blur-md transition-all hover:bg-white/18 hover:border-white/30 active:scale-[0.98] shadow-sm"
            >
                <span className="truncate max-w-[120px]">{label}</span>
                <ChevronDown
                    size={14}
                    strokeWidth={2.5}
                    className={`text-white/70 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full  mt-1 min-w-[200px] overflow-hidden rounded-[var(--radius-sm)] border border-slate-200/80 bg-white/95 backdrop-blur-lg py-0.5 shadow-lg">
                    {/* All stores option */}
                    <button
                        type="button"
                        onClick={() => {
                            onSelect(undefined);
                            setIsOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-surface-card)] ${!selectedId
                            ? "font-semibold text-[var(--color-brand-primary)]"
                            : "text-[var(--color-text-primary)]"
                            }`}
                    >
                        {t.inventoryDashboard.allWarehouses}
                    </button>

                    {warehouses.length > 0 && (
                        <div className="mx-2 my-0.5 h-px bg-slate-200/60" />
                    )}

                    {warehouses.map((warehouse) => (
                        <button
                            key={warehouse.id}
                            type="button"
                            onClick={() => {
                                onSelect(warehouse.id);
                                setIsOpen(false);
                            }}
                            className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors hover:bg-[var(--color-surface-card)] ${selectedId === warehouse.id
                                ? "font-semibold text-[var(--color-brand-primary)]"
                                : "text-[var(--color-text-primary)]"
                                }`}
                        >
                            <div
                                className={`h-1.5 w-1.5 rounded-full ${warehouse.status === "ACTIVE"
                                    ? "bg-[var(--color-accent-success)]"
                                    : "bg-[var(--color-text-muted)]"
                                    }`}
                            />
                            <span className="truncate max-w-[120px]">{warehouse.name}</span>
                            <span className="ml-auto text-xxs text-[var(--color-text-muted)] font-mono">
                                {warehouse.code}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
