"use client";

/**
 * ImportVoucherPage — Main page with 3 tabs
 *
 * Tab layout: "Tạo mới" | "Đang xử lý" | "Lịch sử"
 *
 * RBAC:
 * - hasPermission('vouchers.read') → render page
 * - hasPermission('vouchers.write') → show "Tạo mới" tab
 *
 * LUẬT THÉP:
 * - Skeleton loading while data loads
 * - Realtime via useImportVouchers (onSnapshot)
 * - i18n for all text
 * - Light mode only
 */

import { useState, useMemo } from "react";
import { PackagePlus } from "lucide-react";
import { useTranslation } from "../../../lib/i18n";
import { useUserStore } from "../../../stores/useUserStore";
import { useImportVouchers } from "../../../hooks/useImportVouchers";
import ImportVoucherSkeleton from "./ImportVoucherSkeleton";
import CreateVoucherTab from "./CreateVoucherTab";
import InProgressTab from "./InProgressTab";
import HistoryTab from "./HistoryTab";

// ─────────────────────────────────────────────
// TAB DEFINITIONS
// ─────────────────────────────────────────────

type TabId = "create" | "inProgress" | "history";

interface TabDef {
  id: TabId;
  labelKey: string;
  /** Permission required to see this tab */
  permission?: string;
}

const TAB_DEFINITIONS: TabDef[] = [
  { id: "create", labelKey: "create", permission: "vouchers.write" },
  { id: "inProgress", labelKey: "inProgress" },
  { id: "history", labelKey: "history" },
];

// ─────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────

export default function ImportVoucherPage() {
  const { t } = useTranslation();
  const hasPermission = useUserStore((s) => s.hasPermission);
  const [activeTab, setActiveTab] = useState<TabId>("inProgress");
  const { activeVouchers, completedVouchers, loading } = useImportVouchers();

  // i18n labels for tabs
  const tabLabels: Record<string, string> = useMemo(
    () => ({
      create: t.importVoucher?.tabs?.create ?? "Tạo mới",
      inProgress: t.importVoucher?.tabs?.inProgress ?? "Đang xử lý",
      history: t.importVoucher?.tabs?.history ?? "Lịch sử",
    }),
    [t],
  );

  // Filter visible tabs by permission
  const visibleTabs = useMemo(
    () =>
      TAB_DEFINITIONS.filter((tab) => {
        if (!tab.permission) return true;
        return hasPermission(tab.permission);
      }),
    [hasPermission],
  );

  // Default to first visible tab if current is not visible
  const effectiveTab = useMemo(() => {
    if (visibleTabs.some((tab) => tab.id === activeTab)) return activeTab;
    return visibleTabs[0]?.id ?? "inProgress";
  }, [activeTab, visibleTabs]);

  // Clone data state (for Q1 — rejected voucher → clone)
  const [cloneData, setCloneData] = useState<Record<string, unknown> | null>(
    null,
  );

  // Badge count for "Đang xử lý" tab
  const inProgressCount = activeVouchers.length;

  // Switch to create tab + pre-fill data (for Clone from rejected voucher)
  const handleCloneToCreate = (voucherData: Record<string, unknown>) => {
    setActiveTab("create");
    setCloneData(voucherData);
  };

  const handleTabSwitch = (tabId: TabId) => {
    setActiveTab(tabId);
    if (tabId !== "create") setCloneData(null);
  };

  // Loading state
  if (loading) {
    return <ImportVoucherSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 p-4 lg:gap-5 lg:p-6">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
          <PackagePlus size={18} />
        </div>
        <div>
          <h1 className="text-base font-semibold text-[var(--color-text-primary)] tracking-[-0.3px]">
            {t.importVoucher?.title ?? "Nhập kho"}
          </h1>
          <p className="text-xs text-[var(--color-text-muted)]">
            {t.importVoucher?.subtitle ??
              "Tạo, theo dõi và quản lý lệnh nhập kho"}
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
              onClick={() => handleTabSwitch(tab.id)}
              className={`relative flex items-center gap-1.5 rounded-[var(--radius-xs)] px-3 py-2 text-xs font-medium transition-all ${
                isActive
                  ? "bg-[var(--color-surface-elevated)] text-[var(--color-text-primary)] shadow-sm"
                  : "text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              }`}
            >
              {tabLabels[tab.id] || tab.labelKey}

              {showBadge && (
                <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-[var(--color-brand-primary)] px-1 text-[10px] font-semibold tabular-nums text-white">
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
          <CreateVoucherTab
            cloneData={cloneData}
            onCreated={() => {
              setCloneData(null);
              setActiveTab("inProgress");
            }}
          />
        )}

        {effectiveTab === "inProgress" && (
          <InProgressTab
            vouchers={activeVouchers}
            onClone={handleCloneToCreate}
          />
        )}

        {effectiveTab === "history" && (
          <HistoryTab
            vouchers={completedVouchers}
            onClone={handleCloneToCreate}
          />
        )}
      </div>
    </div>
  );
}
