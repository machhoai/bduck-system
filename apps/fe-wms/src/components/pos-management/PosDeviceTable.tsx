import type { PosDeviceStatus } from "@bduck/shared-types";
import { MonitorCheck, MonitorX } from "lucide-react";

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
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            <th className="px-3 py-2">{copy.device}</th>
            <th className="px-3 py-2">{copy.version}</th>
            <th className="px-3 py-2">{copy.lastOnline}</th>
            <th className="px-3 py-2">{copy.status}</th>
            <th className="px-3 py-2 text-right">{copy.actions}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {devices.map((device) => (
            <tr key={device.id}>
              <td className="px-3 py-2">
                <span className="font-bold text-slate-800">{device.name}</span>
                <span className="block text-slate-400">
                  {device.operating_system}
                </span>
              </td>
              <td className="px-3 py-2">{device.app_version}</td>
              <td className="px-3 py-2">
                {device.last_seen_at
                  ? new Date(device.last_seen_at).toLocaleString()
                  : copy.noHeartbeat}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-flex items-center gap-1 font-bold ${device.status === "ACTIVE" ? "text-emerald-700" : "text-red-700"}`}
                >
                  {device.status === "ACTIVE" ? (
                    <MonitorCheck size={14} />
                  ) : (
                    <MonitorX size={14} />
                  )}
                  {device.status}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap justify-end gap-2">
                  {canManage && transferTargets.length > 0 && (
                    <>
                      <select
                        aria-label={copy.transferTo}
                        value={transferSelection[device.id] || ""}
                        onChange={(event) =>
                          onSelectTransfer(device.id, event.target.value)
                        }
                        className="h-8 max-w-40 rounded-lg border border-slate-200 bg-white px-2 text-xs text-slate-600"
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
                        className="h-8 rounded-lg border border-amber-300 px-3 font-bold text-amber-700 disabled:opacity-40"
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
                      className="h-8 rounded-lg border border-slate-200 px-3 font-bold text-slate-600 hover:border-amber-400"
                    >
                      {device.status === "ACTIVE" ? copy.lock : copy.unlock}
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {devices.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-slate-500">
                {copy.noDevices}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
