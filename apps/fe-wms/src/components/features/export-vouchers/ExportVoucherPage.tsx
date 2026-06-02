"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardList, History, PackageMinus, Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useExportVouchers } from "../../../hooks/useExportVouchers";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import CreateExportTab from "./CreateExportTab";
import ExportHistoryTab from "./ExportHistoryTab";
import ExportInProgressTab from "./ExportInProgressTab";
import ExportVoucherSkeleton from "./ExportVoucherSkeleton";

type TabId = "create" | "inProgress" | "history";

interface TabDef {
  id: TabId;
  labelKey: TabId;
  icon: React.ElementType;
  permission?: string;
}

const TAB_DEFINITIONS: TabDef[] = [
  {
    id: "create",
    labelKey: "create",
    icon: Plus,
    permission: "vouchers.write",
  },
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

export default function ExportVoucherPage() {
  const { t } = useTranslation();
  const hasPermission = useUserStore((state) => state.hasPermission);
  const searchParams = useSearchParams();
  const prefillWarehouseId = searchParams.get("warehouseId") || undefined;
  const [activeTab, setActiveTab] = useState<TabId>(
    prefillWarehouseId ? "create" : "inProgress",
  );
  const [cloneData, setCloneData] = useState<Record<string, unknown> | null>(
    null,
  );
  const { activeVouchers, completedVouchers, loading } = useExportVouchers();

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

  const pendingApprovalCount = activeVouchers.filter(
    (voucher) => voucher.status === "PENDING_APPROVAL",
  ).length;

  const handleCloneToCreate = (voucherData: Record<string, unknown>) => {
    setActiveTab("create");
    setCloneData(voucherData);
  };

  const handleTabSwitch = (tabId: TabId) => {
    setActiveTab(tabId);
    if (tabId !== "create") setCloneData(null);
  };

  if (loading) {
    return <ExportVoucherSkeleton />;
  }

  return (
    <div className="-mx-4 -mt-2 min-h-[calc(100dvh-80px)] bg-[var(--color-surface-subtle)] pb-24 sm:mx-0 sm:mt-0 sm:bg-transparent sm:pb-0">
      <div className="sticky top-0 z-30 border-b border-[var(--color-border-subtle)] bg-white/95 px-4 pb-3 pt-4 backdrop-blur lg:static lg:border-b-0 lg:bg-transparent lg:px-0 lg:pb-0 lg:pt-0">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-orange-50 text-orange-700">
            <PackageMinus size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold tracking-normal text-[var(--color-text-primary)]">
              {t.exportVoucher.title}
            </h1>
            <p className="mt-1 text-sm leading-6 text-[var(--color-text-muted)]">
              {t.exportVoucher.subtitle}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 py-4 lg:px-0 lg:py-5">
        <div className="grid grid-cols-3 gap-2 lg:gap-3">
          <MetricCard
            label={t.exportVoucher.tabs.inProgress}
            value={activeVouchers.length}
            tone="orange"
          />
          <MetricCard
            label={t.exportVoucher.status.PENDING_APPROVAL}
            value={pendingApprovalCount}
            tone="amber"
          />
          <MetricCard
            label={t.exportVoucher.tabs.history}
            value={completedVouchers.length}
            tone="emerald"
          />
        </div>

        <div className="sticky top-[88px] z-20 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-white/95 p-1 shadow-sm backdrop-blur lg:static">
          <div className="grid grid-cols-3 gap-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = effectiveTab === tab.id;
              const badgeCount =
                tab.id === "inProgress"
                  ? activeVouchers.length
                  : tab.id === "history"
                    ? completedVouchers.length
                    : 0;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabSwitch(tab.id)}
                  className={`relative flex h-8 items-center justify-center gap-2 rounded-[var(--radius-sm)] px-2 text-xs font-semibold transition-all active:scale-[0.99] sm:text-sm ${
                    isActive
                      ? "bg-orange-600 text-white shadow-sm"
                      : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-secondary)]"
                  }`}
                >
                  <Icon size={16} />
                  <span className="truncate">
                    {t.exportVoucher.tabs[tab.labelKey]}
                  </span>
                  {badgeCount > 0 && (
                    <span
                      className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xxs font-bold ${
                        isActive
                          ? "bg-white/20 text-white"
                          : "bg-orange-50 text-orange-700"
                      }`}
                    >
                      {badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-[420px]">
          {effectiveTab === "create" && (
            <CreateExportTab
              cloneData={cloneData}
              prefillWarehouseId={prefillWarehouseId}
              onCreated={() => {
                setCloneData(null);
                setActiveTab("inProgress");
              }}
            />
          )}

          {effectiveTab === "inProgress" && (
            <ExportInProgressTab
              vouchers={activeVouchers}
              onClone={handleCloneToCreate}
            />
          )}

          {effectiveTab === "history" && (
            <ExportHistoryTab
              vouchers={completedVouchers}
              onClone={handleCloneToCreate}
            />
          )}
        </div>
      </div>
    </div>
  );
}
