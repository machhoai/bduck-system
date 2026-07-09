"use client";

/**
 * StatCardGrid — KPI summary cards for inventory dashboard
 *
 * ► 7 stat cards: Warehouse count, SKU count, Total, ATP, Quarantine, In-Transit, On-Hold
 * ► Click handler khi ở chế độ "Tất cả kho" → mở popup breakdown
 * ► Skeleton loading khi dữ liệu đang tải
 */

import {
    Warehouse,
    Package,
    PackageCheck,
    ShieldAlert,
    Truck,
    PauseCircle,
    Boxes,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { NumberFlowValue } from "@/components/ui/NumberFlowValue";
import { useTranslation } from "@/lib/i18n";
import type { DashboardKPIs } from "@/utils/inventoryAggregation";

interface StatCardGridProps {
    kpis: DashboardKPIs;
    loading: boolean;
    isAllWarehouses: boolean;
    locationCount?: number;
    onCardClick?: (metric: string) => void;
}

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    loading: boolean;
    color: string;
    bgColor: string;
    clickable: boolean;
    onClick?: () => void;
}

function StatCard({
    icon,
    label,
    value,
    loading,
    color,
    bgColor,
    clickable,
    onClick,
}: StatCardProps) {
    if (loading) {
        return (
            <div className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-5">
                <div className="mb-3 flex items-center gap-3">
                    <Skeleton className="h-8 w-10" variant="rect" />
                    <Skeleton className="h-4 w-24" variant="text" />
                </div>
                <Skeleton className="h-8 w-20" variant="text" />
            </div>
        );
    }

    return (
        <button
            type="button"
            onClick={clickable ? onClick : undefined}
            disabled={!clickable}
            className={`group relative overflow-hidden w-full rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)] p-4 text-left transition-all ${clickable
                ? "cursor-pointer hover:border-[var(--color-brand-primary)] hover:shadow-md active:scale-[0.98]"
                : "cursor-default"
                }`}
        >
            {/* ── Decorative Circles ── */}
            <div 
                className="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-25 pointer-events-none transition-transform duration-300 group-hover:scale-110" 
                style={{ backgroundColor: bgColor }}
            />
            <div 
                className="absolute -right-2 -bottom-8 w-20 h-20 rounded-full opacity-15 pointer-events-none transition-transform duration-300 group-hover:scale-105" 
                style={{ backgroundColor: bgColor }}
            />

            <div className="relative z-10 mb-2 flex items-center justify-between gap-3 w-full">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                    {label}
                </span>
                <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: bgColor, color }}
                >
                    {icon}
                </div>
            </div>
            <p className="relative z-10 text-lg font-bold tracking-tight text-[var(--color-text-primary)]">
                <NumberFlowValue value={value} />
            </p>
        </button>
    );
}

export default function StatCardGrid({
    kpis,
    loading,
    isAllWarehouses,
    locationCount,
    onCardClick,
}: StatCardGridProps) {
    const { t } = useTranslation();
    const d = t.inventoryDashboard;

    const cards = [
        {
            key: "warehouseCount",
            icon: <Warehouse size={20} strokeWidth={1.7} />,
            label: isAllWarehouses ? d.warehouseCount : d.locationCount,
            value: isAllWarehouses ? kpis.warehouseCount : (locationCount ?? 0),
            color: "#6366f1",
            bgColor: "#6366f11a",
        },
        {
            key: "skuCount",
            icon: <Package size={20} strokeWidth={1.7} />,
            label: d.skuCount,
            value: kpis.skuCount,
            color: "#0066cc",
            bgColor: "#0066cc1a",
        },
        {
            key: "totalQuantity",
            icon: <Boxes size={20} strokeWidth={1.7} />,
            label: d.totalQuantity,
            value: kpis.totalQuantity,
            color: "#1d1d1f",
            bgColor: "#1d1d1f0d",
        },
        {
            key: "atpQuantity",
            icon: <PackageCheck size={20} strokeWidth={1.7} />,
            label: d.atpQuantity,
            value: kpis.atpQuantity,
            color: "#257a3e",
            bgColor: "#257a3e1a",
        },
        {
            key: "quarantineQuantity",
            icon: <ShieldAlert size={20} strokeWidth={1.7} />,
            label: d.quarantineQuantity,
            value: kpis.quarantineQuantity,
            color: "#b42318",
            bgColor: "#b423181a",
        },
        {
            key: "inTransitQuantity",
            icon: <Truck size={20} strokeWidth={1.7} />,
            label: d.inTransitQuantity,
            value: kpis.inTransitQuantity,
            color: "#936000",
            bgColor: "#9360001a",
        },
        {
            key: "onHoldQuantity",
            icon: <PauseCircle size={20} strokeWidth={1.7} />,
            label: d.onHoldQuantity,
            value: kpis.onHoldQuantity,
            color: "#7a7a7a",
            bgColor: "#7a7a7a1a",
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
            {cards.map((card) => (
                <StatCard
                    key={card.key}
                    icon={card.icon}
                    label={card.label}
                    value={card.value}
                    loading={loading}
                    color={card.color}
                    bgColor={card.bgColor}
                    clickable={isAllWarehouses}
                    onClick={() => onCardClick?.(card.key)}
                />
            ))}
        </div>
    );
}
