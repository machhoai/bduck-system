"use client";

import {
  ChevronDown,
  History,
  LayoutDashboard,
  Megaphone,
  MonitorSmartphone,
  Settings2,
  ShieldCheck,
  ShoppingBag,
  Store,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";

import Forbidden403 from "@/components/shared/Forbidden403";
import { usePosManagement } from "@/hooks/usePosManagement";
import { useStores } from "@/hooks/useWarehouses";
import { useUserStore } from "@/stores/useUserStore";

import { PosAccessPanel } from "./PosAccessPanel";
import { PosAdvertisingPanel } from "./PosAdvertisingPanel";
import { PosDevicePanel } from "./PosDevicePanel";
import { PosLuckyDrawSettingsPanel } from "./PosLuckyDrawSettingsPanel";
import {
  PosAuditLink,
  PosManagementSkeleton,
  PosNoAccess,
  PosOverview,
} from "./PosManagementSections";
import { PosMobileStoreSheet } from "./PosMobileStoreSheet";
import { PosOrderPanel } from "./PosOrderPanel";
import { PosPaymentSettingsPanel } from "./PosPaymentSettingsPanel";
import { PosProductVisibilityPanel } from "./PosProductVisibilityPanel";
import { PosSettingsPanel } from "./PosSettingsPanel";
import {
  PosSettingsSubNav,
  type SettingsSubTab,
} from "./PosSettingsSubNav";
import { PosStoreRail } from "./PosStoreRail";
import { PosTicketSettingsPanel } from "./PosTicketSettingsPanel";
import { usePosAdvertisingCopy } from "./usePosAdvertisingCopy";
import { usePosManagementCopy } from "./usePosManagementCopy";
import { usePosOrderCopy } from "./usePosOrderCopy";

type Tab =
  | "overview"
  | "devices"
  | "orders"
  | "settings"
  | "advertising"
  | "access"
  | "audit";

export default function PosManagementPage() {
  const copy = usePosManagementCopy();
  const advertisingCopy = usePosAdvertisingCopy();
  const orderCopy = usePosOrderCopy();
  const { stores, loading: storesLoading } = useStores();
  const hasPermission = useUserStore((state) => state.hasPermission);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [settingsSubTab, setSettingsSubTab] = useState<SettingsSubTab>("receipt");
  const [isMobileSheetOpen, setIsMobileSheetOpen] = useState(false);

  const activeStoreId = selectedStoreId || stores[0]?.id || "";
  const activeStore = useMemo(
    () => stores.find((store) => store.id === activeStoreId),
    [activeStoreId, stores],
  );

  const canReadDevices = hasPermission("pos.devices.read", activeStoreId);
  const canManageDevices = hasPermission("pos.devices.manage", activeStoreId);
  const canReadSettings = hasPermission("pos.settings.read", activeStoreId);
  const canReadOrders = hasPermission("pos.orders.read", activeStoreId);
  const canCancelLocal = hasPermission(
    "pos.orders.cancel_local",
    activeStoreId,
  );
  const canRefundRemote = hasPermission(
    "pos.orders.refund_remote",
    activeStoreId,
  );
  const canManageSettings = hasPermission("pos.settings.manage", activeStoreId);
  const canReadAdvertising = hasPermission(
    "pos.advertising.read",
    activeStoreId,
  );
  const canManageAdvertising = hasPermission(
    "pos.advertising.manage",
    activeStoreId,
  );
  const canManageAccess = hasPermission("pos.access.manage", activeStoreId);
  const canReadAudit =
    hasPermission("pos.audit.read", activeStoreId) ||
    hasPermission("audit.read", activeStoreId);
  const canEnter =
    hasPermission("pos.devices.read") ||
    hasPermission("pos.settings.read") ||
    hasPermission("pos.orders.read") ||
    hasPermission("pos.advertising.read") ||
    hasPermission("pos.access.manage") ||
    hasPermission("pos.audit.read");

  const deviceTransferTargets = stores
    .filter(
      (store) =>
        store.id !== activeStoreId &&
        hasPermission("pos.devices.manage", store.id),
    )
    .map((store) => ({ id: store.id, name: store.name }));

  const management = usePosManagement(activeStoreId, {
    devices: canReadDevices,
    settings: canReadSettings,
  });

  const tabs: Array<{ id: Tab; label: string; icon: typeof LayoutDashboard }> = [
    { id: "overview", label: copy.overview, icon: LayoutDashboard },
    { id: "devices", label: copy.devices, icon: MonitorSmartphone },
    { id: "orders", label: orderCopy.tab, icon: ShoppingBag },
    { id: "settings", label: copy.settings, icon: Settings2 },
    { id: "advertising", label: advertisingCopy.tab, icon: Megaphone },
    { id: "access", label: copy.access, icon: Users },
    { id: "audit", label: copy.audit, icon: History },
  ];

  if (!canEnter) return <Forbidden403 />;
  if (storesLoading) return <PosManagementSkeleton />;

  return (
    <div className="flex min-h-0 w-full flex-col gap-3">
      {/* Page Header */}
      <header className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xxs font-bold uppercase tracking-wider text-amber-600">
            {copy.adminArea}
          </p>
          <h1 className="mt-0.5 text-lg font-bold text-slate-900">
            {copy.title}
          </h1>
          <p className="text-xs text-slate-500">{copy.subtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Store Picker Trigger (< 1024px) */}
          {stores.length > 0 && (
            <button
              type="button"
              onClick={() => setIsMobileSheetOpen(true)}
              className="flex h-8 w-full items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 text-xs font-bold text-amber-900 active:bg-amber-100 lg:hidden"
            >
              <div className="flex items-center gap-2 truncate">
                <Store size={15} className="text-amber-600 shrink-0" />
                <span className="truncate">{activeStore?.name}</span>
              </div>
              <ChevronDown size={14} className="text-amber-600 shrink-0" />
            </button>
          )}

          {/* Desktop Security Badge */}
          <div className="hidden items-center gap-2 rounded-lg bg-amber-50 border border-amber-100 px-3 py-1.5 text-xs font-bold text-amber-800 lg:flex">
            <ShieldCheck size={16} className="text-amber-600" />
            <span>{copy.trusted}</span>
          </div>
        </div>
      </header>

      {stores.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-xs text-slate-500">
          {copy.noStores}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-4">
          {/* Desktop Left Rail */}
          <PosStoreRail
            stores={stores}
            activeId={activeStoreId}
            onSelect={(id) => {
              setSelectedStoreId(id);
              setTab("overview");
            }}
          />

          {/* Main Section */}
          <section className="min-w-0 rounded-xl border border-slate-200 bg-white shadow-2xs lg:col-span-3">
            {/* Active Store Desktop Info Header */}
            <div className="hidden items-center justify-between border-b border-slate-100 px-4 py-2.5 lg:flex">
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                  <Store size={16} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-slate-900">
                    {activeStore?.name}
                  </p>
                  <p className="text-xxs text-slate-400">
                    {activeStore?.code || activeStoreId}
                  </p>
                </div>
              </div>
              {management.loading && (
                <span className="flex items-center gap-1.5 text-xxs font-bold text-amber-700 bg-amber-50 px-2 py-1 rounded-md">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                  {copy.syncing}
                </span>
              )}
            </div>

            {/* Navigation Tabs (Native Segmented / Scrollable Pills) */}
            <nav className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2 scrollbar-none">
              {tabs.map((item) => {
                const Icon = item.icon;
                const isActive = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-xs font-bold transition-all ${
                      isActive
                        ? "bg-amber-500 text-white shadow-2xs"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={14} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>

            {/* Tab Content Body */}
            <div className="p-3 sm:p-4">
              {management.error && (
                <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700 border border-red-100">
                  {management.error}
                </p>
              )}
              {tab === "overview" && (
                <PosOverview
                  overview={management.overview}
                  canReadDevices={canReadDevices}
                  settingsVersion={management.settings?.version ?? null}
                />
              )}
              {tab === "devices" &&
                (canReadDevices ? (
                  <PosDevicePanel
                    warehouseId={activeStoreId}
                    devices={management.devices}
                    transferTargets={deviceTransferTargets}
                    canManage={canManageDevices}
                    onChanged={management.refresh}
                  />
                ) : (
                  <PosNoAccess />
                ))}
              {tab === "orders" &&
                (canReadOrders ? (
                  <PosOrderPanel
                    key={activeStoreId}
                    warehouseId={activeStoreId}
                    canRead={canReadOrders}
                    canCancelLocal={canCancelLocal}
                    canRefundRemote={canRefundRemote}
                  />
                ) : (
                  <PosNoAccess />
                ))}
              {tab === "settings" &&
                (canReadSettings ? (
                  <div>
                    <PosSettingsSubNav
                      activeSubTab={settingsSubTab}
                      onSelect={setSettingsSubTab}
                    />
                    {settingsSubTab === "receipt" && (
                      <PosSettingsPanel
                        key={`${activeStoreId}:${management.settings?.version ?? 0}`}
                        warehouseId={activeStoreId}
                        storeName={activeStore?.name || ""}
                        settings={management.settings}
                        canManage={canManageSettings}
                        onChanged={management.refresh}
                      />
                    )}
                    {settingsSubTab === "ticket" && (
                      <PosTicketSettingsPanel
                        key={`${activeStoreId}:${management.ticketSettings?.version ?? 0}:ticket`}
                        warehouseId={activeStoreId}
                        storeName={activeStore?.name || ""}
                        settings={management.ticketSettings}
                        canManage={canManageSettings}
                        onChanged={management.refresh}
                      />
                    )}
                    {settingsSubTab === "lucky-draw" && (
                      <PosLuckyDrawSettingsPanel
                        key={`${activeStoreId}:${management.luckyDrawView?.settings?.version ?? 0}:lucky-draw`}
                        warehouseId={activeStoreId}
                        view={management.luckyDrawView}
                        canManage={canManageSettings}
                        onChanged={management.refresh}
                      />
                    )}
                    {settingsSubTab === "payment" && (
                      <PosPaymentSettingsPanel
                        key={`${activeStoreId}:payment`}
                        devices={management.devices}
                        canManage={canManageSettings}
                      />
                    )}
                    {settingsSubTab === "products" && (
                      <PosProductVisibilityPanel
                        key={`${activeStoreId}:products`}
                        warehouseId={activeStoreId}
                        canManage={canManageSettings}
                      />
                    )}
                  </div>
                ) : (
                  <PosNoAccess />
                ))}
              {tab === "advertising" &&
                (canReadAdvertising ? (
                  <PosAdvertisingPanel
                    key={activeStoreId}
                    warehouseId={activeStoreId}
                    canManage={canManageAdvertising}
                  />
                ) : (
                  <PosNoAccess />
                ))}
              {tab === "access" &&
                (canManageAccess ? (
                  <PosAccessPanel warehouseId={activeStoreId} />
                ) : (
                  <PosNoAccess />
                ))}
              {tab === "audit" &&
                (canReadAudit ? (
                  <PosAuditLink warehouseId={activeStoreId} />
                ) : (
                  <PosNoAccess />
                ))}
            </div>
          </section>
        </div>
      )}

      {/* Mobile Native Store Bottom Sheet */}
      <PosMobileStoreSheet
        isOpen={isMobileSheetOpen}
        stores={stores}
        activeId={activeStoreId}
        onSelect={(id) => {
          setSelectedStoreId(id);
          setTab("overview");
        }}
        onClose={() => setIsMobileSheetOpen(false)}
      />
    </div>
  );
}
