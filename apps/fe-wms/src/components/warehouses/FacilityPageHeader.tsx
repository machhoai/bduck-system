"use client";

import type { ReactNode } from "react";
import {
  Building2,
  LayoutGrid,
  List,
  Map as MapIcon,
  ShieldCheck,
  Warehouse,
} from "lucide-react";
import { useTranslation } from "@/lib/i18n";

export type FacilityPageTab =
  | "warehouses"
  | "officeScopes"
  | "organizations";
export type FacilityViewMode = "map" | "grid" | "list";

interface FacilityPageHeaderProps {
  activeTab: FacilityPageTab;
  viewMode: FacilityViewMode;
  isMapView: boolean;
  canViewOfficeScopes: boolean;
  onTabChange: (tab: FacilityPageTab) => void;
  onViewModeChange: (mode: FacilityViewMode) => void;
}

export function FacilityPageHeader({
  activeTab,
  viewMode,
  isMapView,
  canViewOfficeScopes,
  onTabChange,
  onViewModeChange,
}: FacilityPageHeaderProps) {
  const { t } = useTranslation();
  return (
    <header
      className={
        isMapView
          ? "pointer-events-none absolute left-2 right-2 top-12 z-20 flex flex-col gap-2 md:left-4 md:right-4 md:flex-row md:items-start md:justify-between"
          : "z-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      }
    >
      {isMapView ? (
        <div className="pointer-events-auto hidden flex-col gap-1 rounded-2xl border border-slate-100 bg-white/90 px-3.5 py-2.5 shadow-md backdrop-blur-md md:flex">
          <h1 className="text-xs font-semibold leading-[1.1] text-[var(--color-text-primary)]">
            {t.warehouses.title}
          </h1>
          <p className="text-[10px] text-[var(--color-text-secondary)]">
            {t.warehouses.description}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] px-4 pb-3 pt-2">
          <h1 className="font-[var(--font-display)] text-lg font-semibold leading-[1.1] text-[var(--color-text-primary)]">
            {t.warehouses.title}
          </h1>
          <p className="text-sm leading-none text-[var(--color-text-secondary)]">
            {t.warehouses.description}
          </p>
        </div>
      )}

      <div
        className={
          isMapView
            ? "pointer-events-auto ml-auto flex w-full items-center justify-between gap-2 rounded-full md:ml-0 md:w-fit"
            : "flex items-center gap-2"
        }
      >
        {activeTab === "warehouses" && (
          <div className="flex rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-1">
            <ViewModeButton
              active={viewMode === "map"}
              icon={<MapIcon size={16} />}
              label={t.warehouses.viewMap}
              onClick={() => onViewModeChange("map")}
            />
            <ViewModeButton
              active={viewMode === "grid"}
              icon={<LayoutGrid size={16} />}
              label={t.warehouses.viewGrid}
              onClick={() => onViewModeChange("grid")}
            />
            <ViewModeButton
              active={viewMode === "list"}
              icon={<List size={16} />}
              label={t.warehouses.viewList}
              onClick={() => onViewModeChange("list")}
            />
          </div>
        )}
        <div
          className={`grid ${canViewOfficeScopes ? "grid-cols-3" : "grid-cols-2"} rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-1`}
        >
          <TabButton
            active={activeTab === "warehouses"}
            icon={<Warehouse size={16} />}
            label={t.warehouses.tabWarehouses}
            onClick={() => onTabChange("warehouses")}
          />
          {canViewOfficeScopes && (
            <TabButton
              active={activeTab === "officeScopes"}
              icon={<ShieldCheck size={16} />}
              label={t.officeScope.tabTitle}
              onClick={() => onTabChange("officeScopes")}
            />
          )}
          <TabButton
            active={activeTab === "organizations"}
            icon={<Building2 size={16} />}
            label={t.warehouses.tabOrganizations}
            onClick={() => onTabChange("organizations")}
          />
        </div>
      </div>
    </header>
  );
}

function TabButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex h-8 min-w-10 items-center justify-center gap-2 rounded-full px-3 text-sm transition-all active:scale-95 md:min-w-28 md:px-4 ${active ? "bg-[var(--color-brand-primary)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"}`}
    >
      {icon}
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}

function ViewModeButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`inline-flex h-8 w-9 items-center justify-center rounded-full transition-all active:scale-95 ${active ? "bg-[var(--color-brand-primary)] text-white" : "text-[var(--color-text-muted)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"}`}
    >
      {icon}
    </button>
  );
}
