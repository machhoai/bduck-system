"use client";

/**
 * ExportVoucherPage — Main page with 3 tabs
 *
 * Tab layout: "Tạo mới" | "Đang xử lý" | "Lịch sử"
 *
 * RBAC:
 * - hasPermission('vouchers.write') → show "Tạo mới" tab
 *
 * LUẬT THÉP:
 * - Skeleton loading while data loads
 * - Realtime via useExportVouchers (onSnapshot)
 * - i18n for all text
 * - Light mode only
 */

import { useState, useMemo } from "react";
import { PackageMinus } from "lucide-react";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import { useExportVouchers } from "../../../hooks/useExportVouchers";
import ExportVoucherSkeleton from "./ExportVoucherSkeleton";
import CreateExportTab from "./CreateExportTab";
import ExportInProgressTab from "./ExportInProgressTab";
import ExportHistoryTab from "./ExportHistoryTab";

type TabId = "create" | "inProgress" | "history";

interface TabDef {
  id: TabId;
  labelKey: string;
  permission?: string;
}

const TAB_DEFINITIONS: TabDef[] = [
  { id: "create", labelKey: "create", permission: "vouchers.write" },
  { id: "inProgress", labelKey: "inProgress" },
  { id: "history", labelKey: "history" },
];

export default function ExportVoucherPage() {
  const { t } = useTranslation();
  const hasPermission = useUserStore((s) => s.hasPermission);
  const [activeTab, setActiveTab] = useState<TabId>("inProgress");
  const { activeVouchers, completedVouchers, loading } = useExportVouchers();

  const tabLabels: Record<string, string> = useMemo(
    () => ({
      create: t.exportVoucher?.tabs?.create ?? "Tạo mới",
      inProgress: t.exportVoucher?.tabs?.inProgress ?? "Đang xử lý",
      history: t.exportVoucher?.tabs?.history ?? "Lịch sử",
    }),
    [t],
  );

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

  const inProgressCount = activeVouchers.length;

  if (loading) return <ExportVoucherSkeleton />;

  return (
    <div className="flex flex-col gap-4 p-4 lg:gap-5 lg:p-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-orange-100 text-orange-600">
          <PackageMinus size={18} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[var(--color-text-primary)] tracking-[-0.3px]">
            {t.exportVoucher?.title ?? "Xuất kho"}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t.exportVoucher?.subtitle ?? "Tạo, theo dõi và quản lý lệnh xuất kho"}
          </p>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div className="flex gap-1 rounded-[var(--radius-sm)] bg-[var(--color-surface-card)] p-1">
        {visibleTabs.map((tab) => {
          const isActive = effectiveTab === tab.id;
          const showBadge = tab.id === "inProgress" && inProgressCount > 0;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-1.5 rounded-[var(--radius-xs)] px-3 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {tabLabels[tab.id] || tab.labelKey}
              {showBadge && (
                <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-semibold tabular-nums text-white">
                  {inProgressCount}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="min-h-[400px]">
        {effectiveTab === "create" && (
          <CreateExportTab
            onCreated={() => setActiveTab("inProgress")}
          />
        )}
        {effectiveTab === "inProgress" && (
          <ExportInProgressTab vouchers={activeVouchers} />
        )}
        {effectiveTab === "history" && (
          <ExportHistoryTab vouchers={completedVouchers} />
        )}
      </div>
    </div>
  );
}
