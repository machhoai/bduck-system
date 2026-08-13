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
      color: "text-emerald-600 bg-emerald-50 border-emerald-100",
      badgeColor: "bg-emerald-500",
    },
    {
      label: copy.offlineDevices,
      value: canReadDevices ? (overview?.offline_devices ?? 0) : "—",
      icon: WifiOff,
      color: "text-red-600 bg-red-50 border-red-100",
      badgeColor: "bg-red-500",
    },
    {
      label: copy.configVersion,
      value: settingsVersion !== null && settingsVersion !== undefined ? `v${settingsVersion}` : copy.notCreated,
      icon: Settings2,
      color: "text-amber-600 bg-amber-50 border-amber-100",
      badgeColor: "bg-amber-500",
    },
    {
      label: copy.heartbeat,
      value: overview?.latest_heartbeat_at
        ? new Date(overview.latest_heartbeat_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : copy.never,
      icon: Activity,
      color: "text-blue-600 bg-blue-50 border-blue-100",
      badgeColor: "bg-blue-500",
    },
  ];
  return (
    <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-3 shadow-2xs transition-all hover:border-slate-300"
        >
          <div>
            <p className="text-xxs font-semibold uppercase tracking-wider text-slate-400">
              {card.label}
            </p>
            <p className="mt-1 text-lg font-bold text-slate-900">
              {card.value}
            </p>
          </div>
          <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${card.color}`}>
            <card.icon size={18} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function PosAuditLink({ warehouseId }: { warehouseId: string }) {
  const copy = usePosManagementCopy();
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">{copy.auditTitle}</h2>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">{copy.auditHint}</p>
        </div>
        <Link
          href={`/audit-logs?warehouse_id=${warehouseId}`}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white transition-colors hover:bg-amber-600"
        >
          {copy.openAudit} <ExternalLink size={13} />
        </Link>
      </div>
    </div>
  );
}

export function PosNoAccess() {
  const copy = usePosManagementCopy();
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/60 p-8 text-center text-xs font-medium text-slate-500">
      {copy.noAccess}
    </div>
  );
}

export const PosManagementSkeleton = () => (
  <div className="space-y-3">
    <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
      <div className="hidden h-96 animate-pulse rounded-xl bg-slate-100 lg:block" />
      <div className="h-96 animate-pulse rounded-xl bg-slate-100 lg:col-span-3" />
    </div>
  </div>
);

