"use client";

/**
 * ExpenseShell — Shared layout shell for Expense module
 *
 * Contains:
 * - Page header with title
 * - Warehouse + Period selectors (synced via URL params)
 * - Children slot for page content
 *
 * State flows through URL search params so both pages stay in sync.
 * No tabs — navigation is handled by sidebar menu items.
 */

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "@/lib/i18n";
import { useWarehouses } from "@/hooks/useWarehouses";
import { useUserStore } from "@/stores/useUserStore";
import {
    Calendar,
    ChevronDown,
    Warehouse as WarehouseIcon,
} from "lucide-react";

/** All expense write permissions to check */
const EXPENSE_WRITE_PERMS = [
    "expenses.operations.write",
    "expenses.hr.write",
    "expenses.marketing.write",
    "expenses.merchandise.write",
    "expenses.others.write",
];

function getCurrentPeriod(): string {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

interface ExpenseShellProps {
    children: React.ReactNode;
}

export default function ExpenseShell({ children }: ExpenseShellProps) {
    const { t } = useTranslation();
    const pathname = usePathname();
    const router = useRouter();
    const searchParams = useSearchParams();

    const { warehouses } = useWarehouses();
    const permissions = useUserStore((s) => s.permissions);
    const [autoSelected, setAutoSelected] = useState(false);

    // Read from URL params with fallbacks
    const warehouseId = searchParams.get("warehouse") || "ALL";
    const period = searchParams.get("period") || getCurrentPeriod();

    // Detect page type for subtitle
    const isEntryPage = pathname.endsWith("/entry");

    // Auto-select warehouse if user has write permission for only one
    useEffect(() => {
        if (autoSelected || warehouses.length === 0) return;
        const globalPerms = permissions["global"] || {};
        if (globalPerms["*"] === true) {
            setAutoSelected(true);
            return;
        }
        const writableIds = warehouses.filter((wh) => {
            const whPerms = permissions[wh.id] || {};
            return EXPENSE_WRITE_PERMS.some(
                (p) =>
                    globalPerms[p] === true ||
                    whPerms[p] === true ||
                    whPerms["*"] === true,
            );
        });
        if (writableIds.length === 1) {
            updateParams({ warehouse: writableIds[0].id });
        }
        setAutoSelected(true);
    }, [warehouses, permissions, autoSelected]);

    // Helper to update URL search params without full page reload
    const updateParams = useCallback(
        (updates: Record<string, string>) => {
            const params = new URLSearchParams(searchParams.toString());
            for (const [key, value] of Object.entries(updates)) {
                params.set(key, value);
            }
            router.replace(`${pathname}?${params.toString()}`, { scroll: false });
        },
        [pathname, router, searchParams],
    );

    const handleWarehouseChange = useCallback(
        (newId: string) => updateParams({ warehouse: newId }),
        [updateParams],
    );

    const handlePeriodChange = useCallback(
        (newPeriod: string) => updateParams({ period: newPeriod }),
        [updateParams],
    );

    const selectedWarehouseName =
        warehouseId === "ALL"
            ? t.expenses.selectors.allWarehouses
            : warehouses.find((wh) => wh.id === warehouseId)?.name ?? warehouseId;

    return (
        <div className="space-y-3">
            {/* ── Header ── */}
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="font-[var(--font-display)] text-lg font-bold leading-tight tracking-normal text-text-primary">
                        {isEntryPage ? t.nav.expenseEntry : t.expenses.title}
                    </h1>
                    <p className="mt-0.5 text-sm text-text-muted">
                        {isEntryPage
                            ? `${selectedWarehouseName} · ${period}`
                            : t.expenses.subtitle}
                    </p>
                </div>
            </header>
            {/* Selectors */}
            <div className="flex flex-wrap z-10000 items-center gap-2">
                {/* Period */}
                <div className="relative flex items-center">
                    <Calendar
                        size={14}
                        className="pointer-events-none absolute left-2.5 text-text-muted"
                    />
                    <input
                        type="month"
                        className="h-8 w-full rounded-radius-sm border border-border-subtle bg-surface-input pl-8 pr-3 text-sm text-text-primary focus:border-brand-primary focus:outline-none sm:w-36"
                        value={period}
                        onChange={(e) => handlePeriodChange(e.target.value)}
                    />
                </div>

                {/* Warehouse — Custom dropdown to fix click issues */}
                <div className="relative">
                    <WarehouseIcon
                        size={14}
                        className="pointer-events-none absolute left-2.5 top-1/2 z-10 -translate-y-1/2 text-text-muted"
                    />
                    <ChevronDown
                        size={12}
                        className="pointer-events-none absolute right-2.5 top-1/2 z-10 -translate-y-1/2 text-text-muted"
                    />
                    <select
                        className="relative h-8 w-full cursor-pointer appearance-none rounded-radius-sm border border-border-subtle bg-surface-input pl-8 pr-7 text-sm text-text-primary focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary/30 sm:w-52"
                        value={warehouseId}
                        onChange={(e) => handleWarehouseChange(e.target.value)}
                    >
                        <option value="ALL">
                            {t.expenses.selectors.allWarehouses}
                        </option>
                        {warehouses.map((wh) => (
                            <option key={wh.id} value={wh.id}>
                                {wh.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* ── Page Content ── */}
            {children}
        </div>
    );
}
