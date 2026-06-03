"use client";

import { useMemo, useState, useEffect } from "react";
import {
  ArrowRightLeft,
  ClipboardList,
  History,
  Plus,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTransferOrders } from "../../../hooks/useTransferOrders";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import CreateTransferTab from "./CreateTransferTab";
import TransferDetailDrawer from "./TransferDetailDrawer";
import TransferListTab from "./TransferListTab";
import TransferSkeleton from "./TransferSkeleton";

type TabId = "create" | "inProgress" | "history";

interface TabDef {
  id: TabId;
  labelKey: TabId;
  icon: React.ElementType;
  permission?: string;
}

const TAB_DEFINITIONS: TabDef[] = [
  { id: "create", labelKey: "create", icon: Plus, permission: "transfers.write" },
  { id: "inProgress", labelKey: "inProgress", icon: ClipboardList },
  { id: "history", labelKey: "history", icon: History },
];

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "orange" | "amber" | "emerald";
}) {
  const toneClass = {
    orange: "bg-orange-50 text-orange-700",
    amber: "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[tone];

  return (
    <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-3 shadow-sm">
      <p className="text-xxs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        {label}
      </p>
      <p
        className={`mt-2 inline-flex rounded-lg px-2 py-1 text-lg font-bold ${toneClass}`}
      >
        {value}
      </p>
    </div>
  );
}

export default function TransferPage() {
  const { t } = useTranslation();
  const hasPermission = useUserStore((state) => state.hasPermission);
  const searchParams = useSearchParams();
  const prefillWarehouseId = searchParams.get("warehouseId") || undefined;
  const [activeTab, setActiveTab] = useState<TabId>(
    prefillWarehouseId ? "create" : "inProgress",
  );
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { activeOrders, completedOrders, loading } = useTransferOrders();

  useEffect(() => {
    if (prefillWarehouseId) {
      setActiveTab("create");
    }
  }, [prefillWarehouseId]);

  const visibleTabs = useMemo(
    () =>
      TAB_DEFINITIONS.filter((tab) => {
        if (!tab.permission) return true;
        return hasPermission(tab.permission);
      }),
    [hasPermission],
  );

  const effectiveTab = useMemo(() => {
    if (visibleTabs.some((tab) => tab.id === activeTab)) return activeTab;
    return visibleTabs[0]?.id ?? "inProgress";
  }, [activeTab, visibleTabs]);

  const pendingApprovalCount = activeOrders.filter(
    (o) => o.status === "PENDING_APPROVAL",
  ).length;
  const transferText = t.transfer as typeof t.transfer & {
    metrics?: Record<string, string>;
  };

  const handleTabSwitch = (tabId: TabId) => {
    setActiveTab(tabId);
  };

  if (loading) {
    return <TransferSkeleton />;
  }

  return (
    <div className="-mx-4 -mt-2 min-h-[calc(100dvh-80px)] bg-[var(--color-surface-subtle)] pb-24 sm:mx-0 sm:mt-0 sm:bg-transparent sm:pb-0">
      {/* Header */}
      <div className="border-b border-[var(--color-border-subtle)] bg-white/95 px-4 pb-3 pt-4 lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-11 items-center justify-center rounded-[var(--radius-md)] bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-sm">
            <ArrowRightLeft size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-tight text-[var(--color-text-primary)] lg:text-lg">
              {t.transfer.title}
            </h1>
            <p className="text-xs text-[var(--color-text-muted)] lg:text-sm">
              {t.transfer.subtitle}
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4 px-4 py-4 lg:px-0 lg:py-5">
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          <MetricCard
            label={transferText.metrics?.inProgress ?? t.transfer.tabs.inProgress}
            value={activeOrders.length}
            tone="orange"
          />
          <MetricCard
            label={transferText.metrics?.pendingApproval ?? t.transfer.status.PENDING_APPROVAL}
            value={pendingApprovalCount}
            tone="amber"
          />
          <MetricCard
            label={transferText.metrics?.completed ?? t.transfer.status.COMPLETED}
            value={completedOrders.length}
            tone="emerald"
          />
        </div>

        {/* Tab bar */}
        <div className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white/95 p-1 shadow-sm">
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${visibleTabs.length}, 1fr)`,
            }}
          >
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = effectiveTab === tab.id;
              const badgeCount =
                tab.id === "inProgress"
                  ? activeOrders.length
                  : tab.id === "history"
                    ? completedOrders.length
                    : 0;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabSwitch(tab.id)}
                  className={`relative flex h-8 items-center justify-center gap-1.5 rounded-[var(--radius-sm)] px-2 text-xs font-semibold transition-all active:scale-[0.99] sm:text-sm ${
                    isActive
                      ? "bg-orange-500 text-white shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)]"
                  }`}
                >
                  <Icon size={14} />
                  <span className="truncate">{t.transfer.tabs[tab.labelKey]}</span>
                  {badgeCount > 0 && (
                    <span
                      className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xxs font-bold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-orange-50 text-orange-700"
                      }`}
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        {effectiveTab === "create" && (
          <CreateTransferTab
            prefillWarehouseId={prefillWarehouseId}
            onCreated={() => setActiveTab("inProgress")}
          />
        )}
        {effectiveTab === "inProgress" && (
          <TransferListTab
            orders={activeOrders}
            onViewDetail={(id) => setSelectedOrderId(id)}
          />
        )}
        {effectiveTab === "history" && (
          <TransferListTab
            orders={completedOrders}
            onViewDetail={(id) => setSelectedOrderId(id)}
          />
        )}

        {/* Detail Drawer */}
        {selectedOrderId && (
          <TransferDetailDrawer
            orderId={selectedOrderId}
            onClose={() => setSelectedOrderId(null)}
          />
        )}
      </div>
    </div>
  );
}
