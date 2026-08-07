"use client";

import type { PosDeviceEnrollmentGrant, PosDeviceStatus } from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { KeyRound, MonitorCheck, MonitorX, RefreshCw } from "lucide-react";
import { useState } from "react";

import { posManagementApi, type SafePosDevice } from "@/api/posManagementApi";
import { ActionOtpModal } from "@/components/shared/ActionOtpModal";

import { usePosManagementCopy } from "./usePosManagementCopy";

export function PosDevicePanel({ warehouseId, devices, canManage, onChanged }: {
  warehouseId: string;
  devices: SafePosDevice[];
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const copy = usePosManagementCopy();
  const [showOtp, setShowOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [grant, setGrant] = useState<PosDeviceEnrollmentGrant | null>(null);
  const createCode = async (otp: string) => {
    setSubmitting(true);
    try {
      setGrant(await posManagementApi.createEnrollment(warehouseId, otp));
      setShowOtp(false);
      gooeyToast.success(copy.codeCreated);
    } catch (error) {
      gooeyToast.error(error instanceof Error ? error.message : copy.codeError);
    } finally {
      setSubmitting(false);
    }
  };
  const changeStatus = async (device: SafePosDevice, status: PosDeviceStatus) => {
    const label = status === "REVOKED" ? copy.lock : copy.unlock;
    if (!window.confirm(`${copy.confirmAction} ${label.toLocaleLowerCase()} ${device.name}?`)) return;
    try {
      await posManagementApi.changeDeviceStatus(device.id, status);
      gooeyToast.success(copy.deviceChanged);
      await onChanged();
    } catch (error) {
      gooeyToast.error(error instanceof Error ? error.message : copy.deviceChanged);
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-sm font-black text-slate-900">{copy.deviceTitle}</h2><p className="text-xs text-slate-500">{copy.deviceHint}</p></div>{canManage && <button type="button" onClick={() => setShowOtp(true)} className="flex h-8 items-center gap-2 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white hover:bg-amber-600"><KeyRound size={15} /> {copy.createCode}</button>}</div>
      {grant && <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-3"><div><p className="text-xs font-bold text-amber-700">{copy.oneTimeCode} · {copy.expires} {new Date(grant.expires_at).toLocaleTimeString()}</p><p className="mt-1 font-mono text-2xl font-black tracking-widest text-slate-900">{grant.pairing_code}</p></div><button type="button" onClick={() => void navigator.clipboard.writeText(grant.pairing_code)} className="h-8 rounded-lg border border-amber-300 px-3 text-xs font-bold text-amber-800">{copy.copy}</button></div>}
      <div className="overflow-hidden rounded-xl border border-slate-200"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="px-3 py-2">{copy.device}</th><th className="px-3 py-2">{copy.version}</th><th className="px-3 py-2">{copy.lastOnline}</th><th className="px-3 py-2">{copy.status}</th><th className="px-3 py-2 text-right">{copy.actions}</th></tr></thead><tbody className="divide-y divide-slate-100">
        {devices.map((device) => <tr key={device.id}><td className="px-3 py-2"><span className="font-bold text-slate-800">{device.name}</span><span className="block text-slate-400">{device.operating_system}</span></td><td className="px-3 py-2">{device.app_version}</td><td className="px-3 py-2">{device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : copy.noHeartbeat}</td><td className="px-3 py-2"><span className={`inline-flex items-center gap-1 font-bold ${device.status === "ACTIVE" ? "text-emerald-700" : "text-red-700"}`}>{device.status === "ACTIVE" ? <MonitorCheck size={14} /> : <MonitorX size={14} />}{device.status}</span></td><td className="px-3 py-2 text-right">{canManage && <button type="button" onClick={() => void changeStatus(device, device.status === "ACTIVE" ? "REVOKED" : "ACTIVE")} className="h-8 rounded-lg border border-slate-200 px-3 font-bold text-slate-600 hover:border-amber-400">{device.status === "ACTIVE" ? copy.lock : copy.unlock}</button>}</td></tr>)}
        {devices.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">{copy.noDevices}</td></tr>}
      </tbody></table></div>
      <button type="button" onClick={() => void onChanged()} className="flex h-8 items-center gap-2 text-xs font-bold text-slate-500 hover:text-amber-700"><RefreshCw size={14} /> {copy.refresh}</button>
      {showOtp && <ActionOtpModal title={copy.otpTitle} description={copy.otpDescription} isSubmitting={submitting} onConfirm={(otp) => void createCode(otp)} onCancel={() => setShowOtp(false)} />}
    </div>
  );
}
