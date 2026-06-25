"use client";

import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PackageSearch, ReceiptText, Search } from "lucide-react";
import type { RevenueOrderItem, SoldOrderGoodsItem } from "@/hooks/useRevenueDashboard";
import { useTranslation } from "@/lib/i18n";
import { formatCurrency, formatNumber } from "./revenueDashboardUtils";
import { OrderDetailModal } from "./OrderDetailModal";

interface RevenueOrderTabsProps {
    orders: RevenueOrderItem[];
    soldItems: SoldOrderGoodsItem[];
}

type TabKey = "orders" | "items";

interface Filters {
    employee: string;
    status: string;
    payment: string;
    minAmount: string;
    maxAmount: string;
    search: string;
}

const emptyFilters: Filters = {
    employee: "",
    status: "",
    payment: "",
    minAmount: "",
    maxAmount: "",
    search: "",
};

export default function RevenueOrderTabs({ orders, soldItems }: RevenueOrderTabsProps) {
    const { t } = useTranslation();
    const d = t.revenue.orders;
    const [activeTab, setActiveTab] = useState<TabKey>("orders");
    const [filters, setFilters] = useState<Filters>(emptyFilters);
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

    const orderGoodsIndex = useMemo(() => {
        const index = new Map<string, string>();
        for (const item of soldItems) {
            const current = index.get(item.orderId) ?? "";
            index.set(item.orderId, `${current} ${item.goodsName}`.trim().toLowerCase());
        }
        return index;
    }, [soldItems]);

    const options = useMemo(() => ({
        employees: unique([...orders.map((item) => item.employeeName), ...soldItems.map((item) => item.employeeName)]),
        statuses: unique([...orders.map((item) => item.statusLabel), ...soldItems.map((item) => item.statusLabel)]),
        payments: unique([...orders.map((item) => item.payMethod), ...soldItems.map((item) => item.payMethod)]),
    }), [orders, soldItems]);

    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            const goodsText = orderGoodsIndex.get(order.orderId) ?? "";
            return matchesCommonFilters({
                employeeName: order.employeeName,
                statusLabel: order.statusLabel,
                payMethod: order.payMethod,
                amount: order.realMoney,
                searchable: `${order.orderNumber} ${goodsText}`,
            }, filters);
        });
    }, [filters, orderGoodsIndex, orders]);

    const filteredItems = useMemo(() => {
        return soldItems.filter((item) => matchesCommonFilters({
            employeeName: item.employeeName,
            statusLabel: item.statusLabel,
            payMethod: item.payMethod,
            amount: item.realMoney,
            searchable: `${item.goodsName} ${item.orderNumber} ${item.goodsTypeName} ${item.categoryName}`,
        }, filters));
    }, [filters, soldItems]);

    const updateFilter = (patch: Partial<Filters>) => setFilters((current) => ({ ...current, ...patch }));
    const visibleCount = activeTab === "orders" ? filteredOrders.length : filteredItems.length;

    return (
        <section className="rounded-[var(--radius-lg)] bg-[var(--color-surface-elevated)] p-4 font-sans shadow-sm ring-1 ring-black/[0.04]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">{d.title}</h2>
                    <p className="text-xxs text-[var(--color-text-muted)]">{d.subtitle}</p>
                </div>

                <div className="flex rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-1">
                    <TabButton active={activeTab === "orders"} icon={ReceiptText} label={d.tabs.orders} onClick={() => setActiveTab("orders")} />
                    <TabButton active={activeTab === "items"} icon={PackageSearch} label={d.tabs.items} onClick={() => setActiveTab("items")} />
                </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-6">
                <label className="relative xl:col-span-2">
                    <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
                    <input
                        value={filters.search}
                        onChange={(event) => updateFilter({ search: event.target.value })}
                        placeholder={d.filters.search}
                        className="h-9 w-full rounded-[var(--radius-lg)] bg-slate-100 border border-slate-200 pl-9 pr-3 text-xs font-semibold text-[var(--color-text-primary)] outline-none focus:ring-2 focus:ring-[var(--color-brand-primary)]/20"
                    />
                </label>
                <FilterSelect value={filters.employee} onChange={(value) => updateFilter({ employee: value })} options={options.employees} placeholder={d.filters.employee} />
                <FilterSelect value={filters.status} onChange={(value) => updateFilter({ status: value })} options={options.statuses} placeholder={d.filters.status} />
                <FilterSelect value={filters.payment} onChange={(value) => updateFilter({ payment: value })} options={options.payments} placeholder={d.filters.payment} />
                <div className="grid grid-cols-2 gap-2">
                    <AmountInput value={filters.minAmount} onChange={(value) => updateFilter({ minAmount: value })} placeholder={d.filters.minAmount} />
                    <AmountInput value={filters.maxAmount} onChange={(value) => updateFilter({ maxAmount: value })} placeholder={d.filters.maxAmount} />
                </div>
            </div>

            <div className="mt-3 flex items-center justify-between gap-3 text-xxs text-[var(--color-text-muted)]">
                <span>{formatNumber(visibleCount)} {d.results}</span>
                <button
                    type="button"
                    onClick={() => setFilters(emptyFilters)}
                    className="rounded-full bg-[var(--color-surface-card)] px-3 py-1 font-semibold transition-colors hover:text-[var(--color-text-primary)]"
                >
                    {d.filters.clear}
                </button>
            </div>

            <div className="mt-3">
                {activeTab === "orders" ? <OrderList rows={filteredOrders} onRowClick={setSelectedOrderId} /> : <SoldItemList rows={filteredItems} onRowClick={setSelectedOrderId} />}
            </div>

            {selectedOrderId && (
                <OrderDetailModal orderId={selectedOrderId} onClose={() => setSelectedOrderId(null)} />
            )}
        </section>
    );
}

function TabButton({ active, icon: Icon, label, onClick }: { active: boolean; icon: typeof ReceiptText; label: string; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`relative flex-1 sm:flex-none inline-flex h-8 items-center justify-center gap-2 overflow-hidden rounded-md px-4 text-xs font-bold transition-all duration-300 ${active ? "text-blue-700" : "text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
                }`}
        >
            {active && <span className="absolute inset-0 rounded-md bg-white shadow-sm ring-1 ring-black/5" />}
            <span className="relative z-10 flex items-center gap-2">
                <Icon size={14} className={active ? "text-blue-600" : "text-slate-400"} />
                {label}
            </span>
        </button>
    );
}

function FilterSelect({ value, onChange, options, placeholder }: { value: string; onChange: (value: string) => void; options: string[]; placeholder: string }) {
    return (
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs font-semibold text-slate-700 outline-none transition-all hover:bg-slate-100 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
        >
            <option value="">{placeholder}</option>
            {options.map((option) => (
                <option key={option} value={option}>{option}</option>
            ))}
        </select>
    );
}

function AmountInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
    return (
        <input
            type="number"
            min="0"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className="h-9 min-w-0 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 text-xs font-semibold text-slate-700 outline-none transition-all hover:bg-slate-100 focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
        />
    );
}

function OrderList({ rows, onRowClick }: { rows: RevenueOrderItem[]; onRowClick: (id: string) => void }) {
    const { t } = useTranslation();
    const d = t.revenue.orders.columns;
    if (rows.length === 0) return <EmptyList message={t.revenue.orders.empty} />;

    return (
        <div className="flex flex-col gap-3">
            {rows.map((row) => (
                <div
                    key={row.orderId}
                    onClick={() => onRowClick(row.orderId)}
                    className="group relative flex cursor-pointer items-center justify-between gap-4 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md hover:ring-1 hover:ring-blue-300"
                >
                    <div className="absolute bottom-0 left-0 top-0 w-1 bg-blue-500/20 transition-colors duration-300 group-hover:bg-blue-500" />

                    <div className="flex min-w-0 flex-1 flex-col gap-1.5 pl-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-bold tracking-tight text-slate-800 transition-colors group-hover:text-blue-700">
                                {row.orderNumber || row.orderId}
                            </span>
                            <span className="rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-500/20">
                                {row.statusLabel}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                            <div className="flex items-center gap-1.5">
                                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-slate-200 text-[8px] font-bold text-slate-500 uppercase">
                                    {row.employeeName?.[0] || "?"}
                                </div>
                                <span className="truncate">{row.employeeName}</span>
                            </div>
                            <span className="text-[8px] text-slate-300">•</span>
                            <span className="shrink-0 text-slate-400">{formatTime(row.createTime)}</span>
                            <span className="text-[8px] text-slate-300">•</span>
                            <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-bold">
                                {row.payMethod}
                            </span>
                        </div>
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-base font-black tracking-tight text-blue-600">
                            {formatCurrency(row.realMoney)}
                        </span>
                        <span className="flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm ring-1 ring-slate-900/5 transition-colors group-hover:bg-blue-50 group-hover:text-blue-600 group-hover:ring-blue-500/20">
                            {d.qty}: {formatNumber(row.totalQty)}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function SoldItemList({ rows, onRowClick }: { rows: SoldOrderGoodsItem[]; onRowClick: (id: string) => void }) {
    const { t } = useTranslation();
    const d = t.revenue.orders.columns;
    if (rows.length === 0) return <EmptyList message={t.revenue.orders.empty} />;

    return (
        <div className="flex flex-col gap-3">
            {rows.map((row) => (
                <div
                    key={row.id}
                    onClick={() => onRowClick(row.orderId)}
                    className="group relative flex cursor-pointer flex-col gap-2 overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300 hover:shadow-md hover:ring-1 hover:ring-indigo-300"
                >
                    <div className="absolute bottom-0 left-0 top-0 w-1 bg-indigo-500/20 transition-colors duration-300 group-hover:bg-indigo-500" />

                    <div className="flex items-start justify-between gap-3 pl-2">
                        <div className="flex min-w-0 flex-col gap-1.5">
                            <span className="line-clamp-2 text-sm font-bold leading-tight text-slate-800 transition-colors group-hover:text-indigo-700">
                                {row.goodsName}
                            </span>
                            <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                                <span className="font-bold text-indigo-600/80">{row.orderNumber || row.orderId}</span>
                                <span className="text-[8px] text-slate-300">•</span>
                                <div className="flex items-center gap-1">
                                    <div className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-slate-200 text-[7px] font-bold text-slate-500 uppercase">
                                        {row.employeeName?.[0] || "?"}
                                    </div>
                                    <span className="truncate">{row.employeeName}</span>
                                </div>
                                <span className="text-[8px] text-slate-300">•</span>
                                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 font-bold">{row.payMethod}</span>
                            </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-base font-black tracking-tight text-indigo-600">{formatCurrency(row.realMoney)}</span>
                            <span className="rounded-full bg-emerald-100/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 ring-1 ring-emerald-500/20">
                                {row.statusLabel}
                            </span>
                        </div>
                    </div>

                    <div className="ml-2 mt-1 flex items-center justify-between rounded-lg bg-white p-2.5 text-xs shadow-sm ring-1 ring-slate-900/5 transition-colors group-hover:bg-indigo-50/30">
                        <span className="flex items-center gap-1.5 text-slate-500">
                            {d.price}: <span className="font-bold text-slate-700">{formatCurrency(row.price)}</span>
                        </span>
                        <span className="flex items-center gap-1.5 text-slate-500">
                            {d.qty}: <span className="font-bold text-indigo-700 bg-indigo-100 px-1.5 py-0.5 rounded-md">{formatNumber(row.qty)}</span>
                        </span>
                    </div>
                </div>
            ))}
        </div>
    );
}

function EmptyList({ message }: { message: string }) {
    return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface-card)]/30 py-12">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.02)] ring-1 ring-black/[0.04]">
                <PackageSearch className="h-5 w-5 text-[var(--color-text-muted)]/50" />
            </div>
            <span className="text-sm font-medium text-[var(--color-text-muted)]">{message}</span>
        </div>
    );
}

function matchesCommonFilters(
    item: { employeeName: string; statusLabel: string; payMethod: string; amount: number; searchable: string },
    filters: Filters,
): boolean {
    const min = Number(filters.minAmount || 0);
    const max = Number(filters.maxAmount || Number.POSITIVE_INFINITY);
    const search = filters.search.trim().toLowerCase();
    return (
        (!filters.employee || item.employeeName === filters.employee) &&
        (!filters.status || item.statusLabel === filters.status) &&
        (!filters.payment || item.payMethod === filters.payment) &&
        item.amount >= min &&
        item.amount <= max &&
        (!search || item.searchable.toLowerCase().includes(search))
    );
}

function unique(values: string[]): string[] {
    return Array.from(new Set(values.filter((value) => value && value !== "-"))).sort((a, b) => a.localeCompare(b));
}

function formatTime(value: string): string {
    if (!value) return "-";
    const normalized = value.replace(" ", "T");
    const date = new Date(normalized);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString("vi-VN");
}
