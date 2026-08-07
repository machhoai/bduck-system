import type { PosStoreOverview } from "@bduck/shared-types";
import {
  Activity,
  ExternalLink,
  MonitorSmartphone,
  Settings2,
  WifiOff,
} from "lucide-react";
import Link from "next/link";

import { usePosManagementCopy } from "./usePosManagementCopy";

export function PosOverview({
  overview,
  canReadDevices,
  settingsVersion,
}: {
  overview: PosStoreOverview | null;
  canReadDevices: boolean;
  settingsVersion: number | null;
}) {
  const copy = usePosManagementCopy();
  const cards = [
    {
      label: copy.activeDevices,
      value: canReadDevices ? (overview?.active_devices ?? 0) : "—",
      icon: MonitorSmartphone,
      color: "text-emerald-600",
    },
    {
      label: copy.offlineDevices,
      value: canReadDevices ? (overview?.offline_devices ?? 0) : "—",
      icon: WifiOff,
      color: "text-red-600",
    },
    {
      label: copy.configVersion,
      value: settingsVersion ?? copy.notCreated,
      icon: Settings2,
      color: "text-amber-600",
    },
    {
      label: copy.heartbeat,
      value: overview?.latest_heartbeat_at
        ? new Date(overview.latest_heartbeat_at).toLocaleTimeString()
        : copy.never,
      icon: Activity,
      color: "text-blue-600",
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-xl border border-slate-200 p-3"
        >
          <card.icon size={18} className={card.color} />
          <p className="mt-3 text-xl font-black text-slate-900">{card.value}</p>
          <p className="text-xs font-semibold text-slate-500">{card.label}</p>
        </div>
      ))}
    </div>
  );
}

export function PosAuditLink({ warehouseId }: { warehouseId: string }) {
  const copy = usePosManagementCopy();
  return (
    <div className="rounded-xl border border-slate-200 p-5">
      <h2 className="text-sm font-black text-slate-900">{copy.auditTitle}</h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">{copy.auditHint}</p>
      <Link
        href={`/audit-logs?warehouse_id=${warehouseId}`}
        className="mt-3 inline-flex h-8 items-center gap-2 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white"
      >
        {copy.openAudit} <ExternalLink size={14} />
      </Link>
    </div>
  );
}

export function PosNoAccess() {
  const copy = usePosManagementCopy();
  return (
    <div className="rounded-xl bg-slate-50 p-6 text-center text-xs font-semibold text-slate-500">
      {copy.noAccess}
    </div>
  );
}

export const PosManagementSkeleton = () => (
  <div className="space-y-3">
    <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
    <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
  </div>
);
