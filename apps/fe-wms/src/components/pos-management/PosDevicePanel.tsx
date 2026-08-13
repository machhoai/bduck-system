"use client";

import type {
  PosDeviceEnrollmentGrant,
  PosDeviceStatus,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { KeyRound, RefreshCw } from "lucide-react";
import { useState } from "react";

import { posManagementApi, type SafePosDevice } from "@/api/posManagementApi";
import { ActionOtpModal } from "@/components/shared/ActionOtpModal";

import { PosDeviceTable } from "./PosDeviceTable";
import { usePosManagementCopy } from "./usePosManagementCopy";

export function PosDevicePanel({
  warehouseId,
  devices,
  transferTargets,
  canManage,
  onChanged,
}: {
  warehouseId: string;
  devices: SafePosDevice[];
  transferTargets: Array<{ id: string; name: string }>;
  canManage: boolean;
  onChanged: () => Promise<void>;
}) {
  const copy = usePosManagementCopy();
  const [showOtp, setShowOtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [grant, setGrant] = useState<PosDeviceEnrollmentGrant | null>(null);
  const [transferSelection, setTransferSelection] = useState<
    Record<string, string>
  >({});
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
  const changeStatus = async (
    device: SafePosDevice,
    status: PosDeviceStatus,
  ) => {
    const label = status === "REVOKED" ? copy.lock : copy.unlock;
    if (
      !window.confirm(
        `${copy.confirmAction} ${label.toLocaleLowerCase()} ${device.name}?`,
      )
    )
      return;
    try {
      await posManagementApi.changeDeviceStatus(device.id, status);
      gooeyToast.success(copy.deviceChanged);
      await onChanged();
    } catch (error) {
      gooeyToast.error(
        error instanceof Error ? error.message : copy.deviceChanged,
      );
    }
  };
  const transferDevice = async (device: SafePosDevice) => {
    const targetId = transferSelection[device.id];
    const target = transferTargets.find((store) => store.id === targetId);
    if (
      !target ||
      !window.confirm(
        `${copy.transferConfirm} ${device.name} → ${target.name}?`,
      )
    )
      return;
    try {
      await posManagementApi.transferDevice(device.id, target.id);
      gooeyToast.success(copy.transferDone);
      await onChanged();
    } catch (error) {
      gooeyToast.error(
        error instanceof Error ? error.message : copy.transferError,
      );
    }
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            {copy.deviceTitle}
          </h2>
          <p className="text-xs text-slate-500">{copy.deviceHint}</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => setShowOtp(true)}
            className="flex h-8 items-center gap-2 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white hover:bg-amber-600"
          >
            <KeyRound size={15} /> {copy.createCode}
          </button>
        )}
      </div>
      {grant && (
        <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50/80 p-3">
          <div>
            <p className="text-xxs font-bold text-amber-800">
              {copy.oneTimeCode} · {copy.expires}{" "}
              {new Date(grant.expires_at).toLocaleTimeString()}
            </p>
            <p className="mt-1 font-mono text-lg font-bold tracking-widest text-slate-900">
              {grant.pairing_code}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard.writeText(grant.pairing_code);
              gooeyToast.success(copy.copy);
            }}
            className="h-8 rounded-lg border border-amber-300 bg-white px-3 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-colors"
          >
            {copy.copy}
          </button>
        </div>
      )}
      <PosDeviceTable
        devices={devices}
        transferTargets={transferTargets}
        transferSelection={transferSelection}
        canManage={canManage}
        onSelectTransfer={(deviceId, targetId) =>
          setTransferSelection((current) => ({
            ...current,
            [deviceId]: targetId,
          }))
        }
        onTransfer={(device) => void transferDevice(device)}
        onStatusChange={(device, status) => void changeStatus(device, status)}
      />
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => void onChanged()}
          className="flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-600 hover:border-amber-400 hover:text-amber-700 transition-colors"
        >
          <RefreshCw size={13} /> {copy.refresh}
        </button>
      </div>
      {showOtp && (
        <ActionOtpModal
          title={copy.otpTitle}
          description={copy.otpDescription}
          isSubmitting={submitting}
          onConfirm={(otp) => void createCode(otp)}
          onCancel={() => setShowOtp(false)}
        />
      )}
    </div>
  );
}

