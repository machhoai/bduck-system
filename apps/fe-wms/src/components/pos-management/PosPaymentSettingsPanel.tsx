"use client";

import type {
  PosPaymentSettings,
  PosPaymentSettingsInput,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { Landmark, Save } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { posManagementApi, type SafePosDevice } from "@/api/posManagementApi";

import { usePosManagementCopy } from "./usePosManagementCopy";

const EMPTY: PosPaymentSettingsInput = {
  enabled: false,
  fixedTransferOnly: false,
  bankBin: "",
  accountNumber: "",
  accountName: "",
};

const toInput = (
  settings: PosPaymentSettings | null,
): PosPaymentSettingsInput =>
  settings
    ? {
        enabled: settings.enabled,
        fixedTransferOnly: settings.fixedTransferOnly === true,
        bankBin: settings.bankBin,
        accountNumber: settings.accountNumber,
        accountName: settings.accountName,
      }
    : { ...EMPTY };

export function PosPaymentSettingsPanel({
  devices,
  canManage,
}: {
  devices: SafePosDevice[];
  canManage: boolean;
}) {
  const copy = usePosManagementCopy();
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [settings, setSettings] = useState<PosPaymentSettings | null>(null);
  const [form, setForm] = useState<PosPaymentSettingsInput>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const requestId = useRef(0);
  const activeDeviceId = devices.some(
    (device) => device.id === selectedDeviceId,
  )
    ? selectedDeviceId
    : devices[0]?.id || "";

  const loadSettings = useCallback(
    async (deviceId: string) => {
      const activeRequestId = ++requestId.current;
      if (!deviceId) {
        setSettings(null);
        setForm({ ...EMPTY });
        setLoading(false);
        return;
      }
      setSettings(null);
      setForm({ ...EMPTY });
      setLoading(true);
      try {
        const next = await posManagementApi.getPaymentSettings(deviceId);
        if (requestId.current !== activeRequestId) return;
        setSettings(next);
        setForm(toInput(next));
      } catch (error) {
        if (requestId.current !== activeRequestId) return;
        gooeyToast.error(
          error instanceof Error ? error.message : copy.paymentTitle,
        );
      } finally {
        if (requestId.current === activeRequestId) setLoading(false);
      }
    },
    [copy.paymentTitle],
  );

  useEffect(() => {
    void loadSettings(activeDeviceId);
  }, [activeDeviceId, loadSettings]);

  const save = useCallback(async () => {
    if (!activeDeviceId || saving) return;
    setSaving(true);
    try {
      const saved = await posManagementApi.savePaymentSettings(
        activeDeviceId,
        form,
      );
      setSettings(saved);
      setForm(toInput(saved));
      gooeyToast.success(copy.paymentSaved);
    } catch (error) {
      gooeyToast.error(
        error instanceof Error ? error.message : copy.paymentTitle,
      );
    } finally {
      setSaving(false);
    }
  }, [activeDeviceId, copy.paymentSaved, copy.paymentTitle, form, saving]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Landmark size={18} className="text-amber-600" />
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              {copy.paymentTitle}
            </h2>
            <p className="text-xs text-slate-500">{copy.paymentHint}</p>
          </div>
        </div>
        {canManage && activeDeviceId && (
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading}
            className="flex h-8 items-center gap-2 rounded-lg bg-amber-500 px-3 text-xs font-bold text-white disabled:opacity-50"
          >
            <Save size={14} /> {copy.savePayment}
          </button>
        )}
      </div>

      {devices.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-4 text-xs text-slate-500">
          {copy.noDevices}
        </p>
      ) : (
        <>
          <label className="block max-w-md">
            <span className="text-xs font-bold text-slate-600">
              {copy.paymentDevice}
            </span>
            <select
              value={activeDeviceId}
              onChange={(event) => setSelectedDeviceId(event.target.value)}
              className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800"
            >
              {devices.map((device) => (
                <option key={device.id} value={device.id}>
                  {device.name} · {device.status}
                </option>
              ))}
            </select>
          </label>

          <fieldset
            disabled={!canManage || saving || loading}
            className="grid grid-cols-1 gap-3 md:grid-cols-3"
          >
            <Field
              label={copy.bankBin}
              value={form.bankBin}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  bankBin: value.replace(/\D/g, "").slice(0, 6),
                }))
              }
            />
            <Field
              label={copy.accountNumber}
              value={form.accountNumber}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  accountNumber: value.replace(/\D/g, "").slice(0, 19),
                }))
              }
            />
            <Field
              label={copy.accountName}
              value={form.accountName}
              onChange={(value) =>
                setForm((current) => ({
                  ...current,
                  accountName: value.slice(0, 50),
                }))
              }
            />
          </fieldset>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-bold text-slate-700">
              <input
                type="checkbox"
                checked={form.enabled}
                disabled={!canManage || saving || loading}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    enabled: event.target.checked,
                    ...(!event.target.checked
                      ? { fixedTransferOnly: false }
                      : {}),
                  }))
                }
                className="h-4 w-4 accent-amber-500"
              />
              {copy.enableFallback}
            </label>
            <label className="flex min-h-10 items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-bold text-blue-900">
              <input
                type="checkbox"
                checked={form.fixedTransferOnly}
                disabled={!canManage || saving || loading}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    fixedTransferOnly: event.target.checked,
                    ...(event.target.checked ? { enabled: true } : {}),
                  }))
                }
                className="mt-0.5 h-4 w-4 accent-blue-600"
              />
              <span>
                {copy.fixedTransferOnly}
                <span className="mt-0.5 block font-normal text-blue-700">
                  {copy.fixedTransferOnlyHint}
                </span>
              </span>
            </label>
          </div>
          {settings && settings.deviceId === activeDeviceId && (
            <p className="text-[11px] text-slate-400">
              {copy.version} {settings.version}
            </p>
          )}
        </>
      )}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span className="text-xs font-bold text-slate-600">{label}</span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-3 text-sm"
      />
    </label>
  );
}
