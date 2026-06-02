"use client";

/**
 * WarehouseSelector — Dropdown chọn kho cho dashboard
 *
 * ► Hiển thị "Tất cả kho" + danh sách kho user có quyền
 * ► RBAC: Chỉ hiển thị kho mà user có warehouses.read
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
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 py-2.5 text-sm font-medium text-[var(--color-text-primary)] transition-all hover:border-[var(--color-brand-primary)] hover:shadow-sm active:scale-[0.98]"
            >
                <WarehouseIcon size={18} strokeWidth={1.7} className="text-[var(--color-brand-primary)]" />
                <span className="truncate">{label}</span>
                <ChevronDown
                    size={16}
                    strokeWidth={2}
                    className={`text-[var(--color-text-muted)] transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 min-w-[220px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] py-1 shadow-lg">
                    {/* All warehouses option */}
                    <button
                        type="button"
                        onClick={() => {
                            onSelect(undefined);
                            setIsOpen(false);
                        }}
                        className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-surface-card)] ${!selectedId
                            ? "font-medium text-[var(--color-brand-primary)]"
                            : "text-[var(--color-text-primary)]"
                            }`}
                    >
                        <WarehouseIcon size={16} strokeWidth={1.7} />
                        {t.inventoryDashboard.allWarehouses}
                    </button>

                    {warehouses.length > 0 && (
                        <div className="mx-3 my-1 h-px bg-[var(--color-border-soft)]" />
                    )}

                    {warehouses.map((warehouse) => (
                        <button
                            key={warehouse.id}
                            type="button"
                            onClick={() => {
                                onSelect(warehouse.id);
                                setIsOpen(false);
                            }}
                            className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm transition-colors hover:bg-[var(--color-surface-card)] ${selectedId === warehouse.id
                                ? "font-medium text-[var(--color-brand-primary)]"
                                : "text-[var(--color-text-primary)]"
                                }`}
                        >
                            <div
                                className="h-2 w-2 rounded-full"
                                style={{
                                    backgroundColor:
                                        warehouse.status === "ACTIVE"
                                            ? "var(--color-accent-success)"
                                            : "var(--color-text-muted)",
                                }}
                            />
                            <span className="truncate">{warehouse.name}</span>
                            <span className="ml-auto text-xs text-[var(--color-text-muted)]">
                                {warehouse.code}
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
