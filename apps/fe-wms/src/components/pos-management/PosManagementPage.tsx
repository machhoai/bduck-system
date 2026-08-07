"use client";

import { Activity, ExternalLink, MonitorSmartphone, Settings2, ShieldCheck, Store, WifiOff } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import Forbidden403 from "@/components/shared/Forbidden403";
import { usePosManagement } from "@/hooks/usePosManagement";
import { useStores } from "@/hooks/useWarehouses";
import { useUserStore } from "@/stores/useUserStore";

import { PosAccessPanel } from "./PosAccessPanel";
import { PosDevicePanel } from "./PosDevicePanel";
import { PosPaymentSettingsPanel } from "./PosPaymentSettingsPanel";
import { PosSettingsPanel } from "./PosSettingsPanel";
import { PosStoreRail } from "./PosStoreRail";
import { usePosManagementCopy } from "./usePosManagementCopy";

type Tab = "overview" | "devices" | "settings" | "access" | "audit";

export default function PosManagementPage() {
  const copy = usePosManagementCopy();
  const { stores, loading: storesLoading } = useStores();
  const hasPermission = useUserStore((state) => state.hasPermission);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const activeStoreId = selectedStoreId || stores[0]?.id || "";
  const activeStore = useMemo(() => stores.find((store) => store.id === activeStoreId), [activeStoreId, stores]);
  const canReadDevices = hasPermission("pos.devices.read", activeStoreId);
  const canManageDevices = hasPermission("pos.devices.manage", activeStoreId);
  const canReadSettings = hasPermission("pos.settings.read", activeStoreId);
  const canManageSettings = hasPermission("pos.settings.manage", activeStoreId);
  const canManageAccess = hasPermission("pos.access.manage", activeStoreId);
  const canReadAudit = hasPermission("pos.audit.read", activeStoreId) || hasPermission("audit.read", activeStoreId);
  const canEnter = hasPermission("pos.devices.read") || hasPermission("pos.settings.read") || hasPermission("pos.access.manage") || hasPermission("pos.audit.read");
  const management = usePosManagement(activeStoreId, { devices: canReadDevices, settings: canReadSettings });
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "overview", label: copy.overview }, { id: "devices", label: copy.devices },
    { id: "settings", label: copy.settings }, { id: "access", label: copy.access },
    { id: "audit", label: copy.audit },
  ];

  if (!canEnter) return <Forbidden403 />;
  if (storesLoading) return <PosManagementSkeleton />;
  return (
    <div className="flex min-h-0 w-full flex-col gap-3">
      <header className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
        <div><p className="text-xs font-bold uppercase text-amber-600">{copy.adminArea}</p><h1 className="mt-1 text-lg font-black text-slate-900">{copy.title}</h1><p className="text-xs text-slate-500">{copy.subtitle}</p></div>
        <div className="hidden items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 md:flex"><ShieldCheck size={16} /> {copy.trusted}</div>
      </header>
      {stores.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">{copy.noStores}</div> : (
        <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-4">
          <PosStoreRail stores={stores} activeId={activeStoreId} onSelect={(id) => { setSelectedStoreId(id); setTab("overview"); }} />
          <section className="min-w-0 rounded-xl border border-slate-200 bg-white lg:col-span-3">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3"><div className="flex min-w-0 items-center gap-2"><Store size={17} className="text-amber-600" /><div className="min-w-0"><p className="truncate text-sm font-black text-slate-900">{activeStore?.name}</p><p className="text-xs text-slate-500">{activeStore?.code || activeStoreId}</p></div></div>{management.loading && <span className="text-xs font-bold text-amber-700">{copy.syncing}</span>}</div>
            <nav className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-2">{tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`h-8 whitespace-nowrap border-b-2 px-3 text-xs font-bold ${tab === item.id ? "border-amber-500 text-amber-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{item.label}</button>)}</nav>
            <div className="p-4">
              {management.error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-xs font-bold text-red-700">{management.error}</p>}
              {tab === "overview" && <Overview overview={management.overview} canReadDevices={canReadDevices} settingsVersion={management.settings?.version ?? null} />}
              {tab === "devices" && (canReadDevices ? <PosDevicePanel warehouseId={activeStoreId} devices={management.devices} canManage={canManageDevices} onChanged={management.refresh} /> : <NoAccess />)}
              {tab === "settings" && (canReadSettings ? <div className="space-y-4"><PosSettingsPanel key={`${activeStoreId}:${management.settings?.version ?? 0}`} warehouseId={activeStoreId} storeName={activeStore?.name || ""} settings={management.settings} canManage={canManageSettings} onChanged={management.refresh} /><PosPaymentSettingsPanel key={`${activeStoreId}:${management.paymentSettings?.version ?? 0}:payment`} warehouseId={activeStoreId} settings={management.paymentSettings} canManage={canManageSettings} onChanged={management.refresh} /></div> : <NoAccess />)}
              {tab === "access" && (canManageAccess ? <PosAccessPanel warehouseId={activeStoreId} /> : <NoAccess />)}
              {tab === "audit" && (canReadAudit ? <AuditLink warehouseId={activeStoreId} /> : <NoAccess />)}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Overview({ overview, canReadDevices, settingsVersion }: { overview: ReturnType<typeof usePosManagement>["overview"]; canReadDevices: boolean; settingsVersion: number | null }) {
  const copy = usePosManagementCopy();
  const cards = [
    { label: copy.activeDevices, value: canReadDevices ? overview?.active_devices ?? 0 : "—", icon: MonitorSmartphone, color: "text-emerald-600" },
    { label: copy.offlineDevices, value: canReadDevices ? overview?.offline_devices ?? 0 : "—", icon: WifiOff, color: "text-red-600" },
    { label: copy.configVersion, value: settingsVersion ?? copy.notCreated, icon: Settings2, color: "text-amber-600" },
    { label: copy.heartbeat, value: overview?.latest_heartbeat_at ? new Date(overview.latest_heartbeat_at).toLocaleTimeString() : copy.never, icon: Activity, color: "text-blue-600" },
  ];
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map((card) => <div key={card.label} className="rounded-xl border border-slate-200 p-3"><card.icon size={18} className={card.color} /><p className="mt-3 text-xl font-black text-slate-900">{card.value}</p><p className="text-xs font-semibold text-slate-500">{card.label}</p></div>)}</div>;
}

function AuditLink({ warehouseId }: { warehouseId: string }) {
  const copy = usePosManagementCopy();
  return <div className="rounded-xl border border-slate-200 p-5"><h2 className="text-sm font-black text-slate-900">{copy.auditTitle}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{copy.auditHint}</p><Link href={`/audit-logs?warehouse_id=${warehouseId}`} className="mt-3 inline-flex h-8 items-center gap-2 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white">{copy.openAudit} <ExternalLink size={14} /></Link></div>;
}

function NoAccess() { const copy = usePosManagementCopy(); return <div className="rounded-xl bg-slate-50 p-6 text-center text-xs font-semibold text-slate-500">{copy.noAccess}</div>; }
const PosManagementSkeleton = () => <div className="space-y-3"><div className="h-24 animate-pulse rounded-xl bg-slate-100" /><div className="h-96 animate-pulse rounded-xl bg-slate-100" /></div>;
