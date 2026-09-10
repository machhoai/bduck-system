"use client";

import type { RevenueOrderItem, SoldOrderGoodsItem } from "@bduck/shared-types";
import { PackageSearch, ReceiptText } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import { useTranslation } from "@/lib/i18n";

import { OrderDetailModal } from "./OrderDetailModal";
import RevenueOrderFilterBar from "./RevenueOrderFilterBar";
import {
  emptyRevenueOrderFilters,
  matchesRevenueOrderFilters,
  uniqueRevenueOrderValues,
  type RevenueOrderFilters,
} from "./revenueOrderFilters";
import { RevenueOrderList, RevenueSoldItemList } from "./RevenueOrderLists";
import RevenueOrderPagination from "./RevenueOrderPagination";

interface RevenueOrderTabsProps {
  orders: RevenueOrderItem[];
  soldItems: SoldOrderGoodsItem[];
}

type TabKey = "orders" | "items";

export default function RevenueOrderTabs({
  orders,
  soldItems,
}: RevenueOrderTabsProps) {
  const { t } = useTranslation();
  const copy = t.revenue.orders;
  const [activeTab, setActiveTab] = useState<TabKey>("orders");
  const [filters, setFilters] = useState<RevenueOrderFilters>(
    emptyRevenueOrderFilters,
  );
  const deferredFilters = useDeferredValue(filters);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const orderGoodsIndex = useMemo(() => {
    const index = new Map<string, string>();
    for (const item of soldItems) {
      const current = index.get(item.orderId) ?? "";
      index.set(
        item.orderId,
        `${current} ${item.goodsName}`.trim().toLowerCase(),
      );
    }
    return index;
  }, [soldItems]);

  const options = useMemo(
    () => ({
      employees: uniqueRevenueOrderValues([
        ...orders.map((item) => item.employeeName),
        ...soldItems.map((item) => item.employeeName),
      ]),
      statuses: uniqueRevenueOrderValues([
        ...orders.map((item) => item.statusLabel),
        ...soldItems.map((item) => item.statusLabel),
      ]),
      payments: uniqueRevenueOrderValues([
        ...orders.map((item) => item.payMethod),
        ...soldItems.map((item) => item.payMethod),
      ]),
    }),
    [orders, soldItems],
  );

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) =>
        matchesRevenueOrderFilters(
          {
            employeeName: order.employeeName,
            statusLabel: order.statusLabel,
            payMethod: order.payMethod,
            amount: order.realMoney,
            searchable: `${order.orderNumber} ${orderGoodsIndex.get(order.orderId) ?? ""}`,
          },
          deferredFilters,
        ),
      ),
    [deferredFilters, orderGoodsIndex, orders],
  );

  const filteredItems = useMemo(
    () =>
      soldItems.filter((item) =>
        matchesRevenueOrderFilters(
          {
            employeeName: item.employeeName,
            statusLabel: item.statusLabel,
            payMethod: item.payMethod,
            amount: item.realMoney,
            searchable: `${item.goodsName} ${item.orderNumber} ${item.goodsTypeName} ${item.categoryName}`,
          },
          deferredFilters,
        ),
      ),
    [deferredFilters, soldItems],
  );

  const activeRows = activeTab === "orders" ? filteredOrders : filteredItems;
  const totalPages = Math.max(1, Math.ceil(activeRows.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const visibleOrders = filteredOrders.slice(startIndex, startIndex + pageSize);
  const visibleItems = filteredItems.slice(startIndex, startIndex + pageSize);

  const updateFilters = (patch: Partial<RevenueOrderFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(1);
  };

  const changeTab = (tab: TabKey) => {
    setActiveTab(tab);
    setPage(1);
  };

  return (
    <div className="space-y-4 p-4 sm:p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex w-full rounded-[var(--radius-md)] bg-[var(--color-surface-card)] p-1 sm:w-auto">
          <TabButton
            active={activeTab === "orders"}
            icon={ReceiptText}
            label={`${copy.tabs.orders} (${orders.length})`}
            onClick={() => changeTab("orders")}
          />
          <TabButton
            active={activeTab === "items"}
            icon={PackageSearch}
            label={`${copy.tabs.items} (${soldItems.length})`}
            onClick={() => changeTab("items")}
          />
        </div>
        <span className="text-xxs font-semibold text-[var(--color-text-muted)]">
          {activeRows.length} {copy.results}
        </span>
      </div>

      <RevenueOrderFilterBar
        filters={filters}
        options={options}
        onChange={updateFilters}
        onClear={() => {
          setFilters(emptyRevenueOrderFilters);
          setPage(1);
        }}
      />

      {activeTab === "orders" ? (
        <RevenueOrderList
          rows={visibleOrders}
          onRowClick={setSelectedOrderId}
        />
      ) : (
        <RevenueSoldItemList
          rows={visibleItems}
          onRowClick={setSelectedOrderId}
        />
      )}

      <RevenueOrderPagination
        page={safePage}
        pageSize={pageSize}
        totalItems={activeRows.length}
        onPageChange={setPage}
        onPageSizeChange={(nextPageSize) => {
          setPageSize(nextPageSize);
          setPage(1);
        }}
      />

      {selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={() => setSelectedOrderId(null)}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof ReceiptText;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-xs font-bold transition-colors sm:flex-none ${
        active
          ? "bg-white text-[var(--color-brand-primary)] shadow-sm"
          : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
      }`}
    >
      <Icon size={14} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </button>
  );
}
