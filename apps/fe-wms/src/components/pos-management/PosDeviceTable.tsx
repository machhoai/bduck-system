import type { PosDeviceStatus } from "@bduck/shared-types";
import { ArrowRightLeft, Lock, MonitorCheck, MonitorX, Unlock } from "lucide-react";

import type { SafePosDevice } from "@/api/posManagementApi";

import { usePosManagementCopy } from "./usePosManagementCopy";

interface PosDeviceTableProps {
  devices: SafePosDevice[];
  transferTargets: Array<{ id: string; name: string }>;
  transferSelection: Record<string, string>;
  canManage: boolean;
  onSelectTransfer: (deviceId: string, warehouseId: string) => void;
  onTransfer: (device: SafePosDevice) => void;
  onStatusChange: (device: SafePosDevice, status: PosDeviceStatus) => void;
}

export function PosDeviceTable({
  devices,
  transferTargets,
  transferSelection,
  canManage,
  onSelectTransfer,
  onTransfer,
  onStatusChange,
}: PosDeviceTableProps) {
  const copy = usePosManagementCopy();

  if (devices.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-8 text-center text-xs text-slate-500">
        {copy.noDevices}
      </div>
    );
  }

  return (
    <>
      {/* Mobile Native App Cards View (< 640px) */}
      <div className="space-y-2.5 sm:hidden">
        {devices.map((device) => {
          const isActive = device.status === "ACTIVE";
          return (
            <div
              key={device.id}
              className="rounded-xl border border-slate-200 bg-white p-3 shadow-2xs transition-all active:scale-[0.99]"
            >
              {/* Card Header: Device Name & Status */}
              <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    {device.name}
                  </h4>
                  <p className="text-xxs text-slate-400">
                    {device.operating_system} · v{device.app_version}
                  </p>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xxs font-bold ${
                    isActive
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-red-50 text-red-700 border border-red-200"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-emerald-500 animate-pulse" : "bg-red-500"
                    }`}
                  />
                  {device.status}
                </span>
              </div>

              {/* Card Metadata */}
              <div className="mt-2 flex items-center justify-between text-xxs text-slate-500">
                <span>{copy.lastOnline}:</span>
                <span className="font-medium text-slate-700">
                  {device.last_seen_at
                    ? new Date(device.last_seen_at).toLocaleString([], {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : copy.noHeartbeat}
                </span>
              </div>

              {/* Actions Section */}
              {canManage && (
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-2.5">
                  {transferTargets.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <select
                        aria-label={copy.transferTo}
                        value={transferSelection[device.id] || ""}
                        onChange={(event) =>
                          onSelectTransfer(device.id, event.target.value)
                        }
                        className="h-7 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 text-xxs font-medium text-slate-700 outline-none focus:border-amber-500"
                      >
                        <option value="">{copy.transferTo}</option>
                        {transferTargets.map((store) => (
                          <option key={store.id} value={store.id}>
                            {store.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={!transferSelection[device.id]}
                        onClick={() => onTransfer(device)}
                        className="flex h-7 shrink-0 items-center gap-1 rounded-lg bg-amber-50 px-2.5 text-xxs font-bold text-amber-800 border border-amber-200 disabled:opacity-40"
                      >
                        <ArrowRightLeft size={12} /> {copy.transfer}
                      </button>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      onStatusChange(
                        device,
                        isActive ? "REVOKED" : "ACTIVE",
                      )
                    }
                    className={`flex h-7 w-full items-center justify-center gap-1.5 rounded-lg text-xxs font-bold transition-colors ${
                      isActive
                        ? "border border-slate-200 text-slate-700 hover:bg-slate-50"
                        : "bg-emerald-50 border border-emerald-200 text-emerald-800"
                    }`}
                  >
                    {isActive ? (
                      <>
                        <Lock size={12} /> {copy.lock}
                      </>
                    ) : (
                      <>
                        <Unlock size={12} /> {copy.unlock}
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Desktop Data Grid View (>= 640px) */}
      <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xs sm:block">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-100 bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-xxs font-semibold uppercase tracking-wider">
                {copy.device}
              </th>
              <th className="px-3 py-2 text-xxs font-semibold uppercase tracking-wider">
                {copy.version}
              </th>
              <th className="px-3 py-2 text-xxs font-semibold uppercase tracking-wider">
                {copy.lastOnline}
              </th>
              <th className="px-3 py-2 text-xxs font-semibold uppercase tracking-wider">
                {copy.status}
              </th>
              <th className="px-3 py-2 text-right text-xxs font-semibold uppercase tracking-wider">
                {copy.actions}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {devices.map((device) => (
              <tr key={device.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="px-3 py-2">
                  <span className="font-bold text-slate-800">{device.name}</span>
                  <span className="block text-xxs text-slate-400">
                    {device.operating_system}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono text-xxs text-slate-600">
                  {device.app_version}
                </td>
                <td className="px-3 py-2 text-slate-600 text-xxs">
                  {device.last_seen_at
                    ? new Date(device.last_seen_at).toLocaleString()
                    : copy.noHeartbeat}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex items-center gap-1.5 text-xxs font-bold ${
                      device.status === "ACTIVE"
                        ? "text-emerald-700"
                        : "text-red-700"
                    }`}
                  >
                    {device.status === "ACTIVE" ? (
                      <MonitorCheck size={14} className="text-emerald-600" />
                    ) : (
                      <MonitorX size={14} className="text-red-600" />
                    )}
                    {device.status}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex items-center justify-end gap-1.5">
                    {canManage && transferTargets.length > 0 && (
                      <>
                        <select
                          aria-label={copy.transferTo}
                          value={transferSelection[device.id] || ""}
                          onChange={(event) =>
                            onSelectTransfer(device.id, event.target.value)
                          }
                          className="h-6 w-36 rounded-md border border-slate-200 bg-white px-1.5 text-xxs text-slate-600 outline-none focus:border-amber-500"
                        >
                          <option value="">{copy.transferTo}</option>
                          {transferTargets.map((store) => (
                            <option key={store.id} value={store.id}>
                              {store.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!transferSelection[device.id]}
                          onClick={() => onTransfer(device)}
                          className="h-6 rounded-md border border-amber-300 bg-amber-50/50 px-2 text-xxs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-40 transition-colors"
                        >
                          {copy.transfer}
                        </button>
                      </>
                    )}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() =>
                          onStatusChange(
                            device,
                            device.status === "ACTIVE" ? "REVOKED" : "ACTIVE",
                          )
                        }
                        className="h-6 rounded-md border border-slate-200 bg-white px-2 text-xxs font-bold text-slate-700 hover:border-amber-400 hover:bg-slate-50 transition-colors"
                      >
                        {device.status === "ACTIVE" ? copy.lock : copy.unlock}
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

