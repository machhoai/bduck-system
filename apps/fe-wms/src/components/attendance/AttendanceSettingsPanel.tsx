"use client";

import type {
  EmployeeProfile,
  User,
  UserWarehouseRole,
  Warehouse,
  WarehouseAttendanceExemption,
  WarehouseAttendancePolicy,
} from "@bduck/shared-types";
import { motion } from "framer-motion";
import { Plus, Save, Settings2, Trash2 } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useEffect, useMemo, useState } from "react";

interface AttendanceSettingsPanelProps {
  labels: Record<string, string>;
  canConfigure: boolean;
  warehouses: Warehouse[];
  users: Array<User & { assignments?: UserWarehouseRole[] }>;
  profiles: EmployeeProfile[];
  selectedWarehouseId: string;
  policies: Map<string, WarehouseAttendancePolicy>;
  exemptions: WarehouseAttendanceExemption[];
  onWarehouseChange: (warehouseId: string) => void;
  onSavePolicy: (
    warehouseId: string,
    payload: { enabled: boolean; ip_addresses: string[] },
  ) => Promise<unknown>;
  onSaveExemptions: (
    warehouseId: string,
    excludedUserIds: string[],
  ) => Promise<unknown>;
}

export function AttendanceSettingsPanel({
  labels,
  canConfigure,
  warehouses,
  users,
  profiles,
  selectedWarehouseId,
  policies,
  exemptions,
  onWarehouseChange,
  onSavePolicy,
  onSaveExemptions,
}: AttendanceSettingsPanelProps) {
  const activeWarehouseId =
    selectedWarehouseId !== "ALL"
      ? selectedWarehouseId
      : warehouses[0]?.id || "";
  const policy = activeWarehouseId ? policies.get(activeWarehouseId) : null;
  const [enabled, setEnabled] = useState(Boolean(policy?.enabled));
  const [ipAddresses, setIpAddresses] = useState<string[]>(
    policy?.ip_addresses?.length ? policy.ip_addresses : [""],
  );
  const [excludedUserIds, setExcludedUserIds] = useState<string[]>([]);

  useEffect(() => {
    setEnabled(Boolean(policy?.enabled));
    setIpAddresses(policy?.ip_addresses?.length ? policy.ip_addresses : [""]);
  }, [policy]);

  useEffect(() => {
    setExcludedUserIds(exemptions.map((item) => item.user_id));
  }, [exemptions]);

  const userById = useMemo(
    () => new Map(users.map((item) => [item.id, item])),
    [users],
  );
  const warehouseProfiles = useMemo(
    () =>
      profiles.filter(
        (profile) =>
          profile.user_id &&
          profile.workplace_warehouse_id === activeWarehouseId &&
          userById.has(profile.user_id),
      ),
    [activeWarehouseId, profiles, userById],
  );

  if (!canConfigure || warehouses.length === 0) return null;

  const handlePolicySave = async () => {
    const cleanIps = Array.from(
      new Set(ipAddresses.map((ip) => ip.trim()).filter(Boolean)),
    );
    const task = onSavePolicy(activeWarehouseId, {
      enabled,
      ip_addresses: cleanIps,
    });
    await gooeyToast.promise(task, {
      loading: labels.savingSettings,
      success: labels.saveSettingsSuccess,
      error: labels.saveSettingsError,
      description: {
        success: labels.saveSettingsSuccessDesc,
        error: labels.saveSettingsErrorDesc,
      },
      action: {
        error: { label: labels.retry, onClick: () => void handlePolicySave() },
      },
    });
  };

  const handleExemptionsSave = async () => {
    const task = onSaveExemptions(activeWarehouseId, excludedUserIds);
    await gooeyToast.promise(task, {
      loading: labels.savingExemptions,
      success: labels.saveExemptionsSuccess,
      error: labels.saveSettingsError,
      description: {
        success: labels.saveExemptionsSuccessDesc,
        error: labels.saveSettingsErrorDesc,
      },
      action: {
        error: {
          label: labels.retry,
          onClick: () => void handleExemptionsSave(),
        },
      },
    });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[var(--radius-lg)] border border-[var(--color-border-soft)] bg-[var(--color-surface-elevated)]"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border-soft)] p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[#0066cc14] text-[#0066cc]">
            <Settings2 size={17} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              {labels.settings}
            </h2>
            <p className="text-xs text-[var(--color-text-muted)]">
              {labels.settingsHint}
            </p>
          </div>
        </div>
        <select
          value={activeWarehouseId}
          onChange={(event) => onWarehouseChange(event.target.value)}
          className="h-9 min-w-52 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
        >
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 p-4 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] p-4">
          <label className="mb-4 flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
              {labels.enableAttendance}
            </span>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
              className="h-5 w-5 accent-[var(--color-brand-primary)]"
            />
          </label>

          <div className="grid gap-2">
            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
              {labels.allowedIps}
            </p>
            {ipAddresses.map((ip, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  value={ip}
                  onChange={(event) =>
                    setIpAddresses((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? event.target.value : item,
                      ),
                    )
                  }
                  placeholder="113.161.0.1"
                  className="h-9 min-w-0 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border-subtle)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
                />
                <button
                  type="button"
                  title={labels.removeIp}
                  onClick={() =>
                    setIpAddresses((current) =>
                      current.length === 1
                        ? [""]
                        : current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                  className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] text-[#b42318] hover:bg-[#b4231810]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setIpAddresses((current) => [...current, ""])}
              className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-sm)] px-2 text-xs font-semibold text-[var(--color-brand-primary)] hover:bg-[var(--color-surface-card)]"
            >
              <Plus size={14} />
              {labels.addIp}
            </button>
          </div>

          <button
            type="button"
            onClick={() => void handlePolicySave()}
            className="mt-4 inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-brand-primary)] text-sm font-semibold text-white transition-all active:scale-[0.98]"
          >
            <Save size={15} />
            {labels.saveSettings}
          </button>
        </div>

        <div className="rounded-[var(--radius-sm)] border border-[var(--color-border-soft)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {labels.exemptions}
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                {labels.exemptionsHint}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleExemptionsSave()}
              className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-sm)] bg-[#257a3e] px-3 text-xs font-semibold text-white transition-all active:scale-[0.98]"
            >
              <Save size={14} />
              {labels.save}
            </button>
          </div>

          <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2">
            {warehouseProfiles.map((profile) => {
              const userId = profile.user_id || "";
              const checked = excludedUserIds.includes(userId);
              return (
                <label
                  key={profile.id}
                  className={`flex cursor-pointer items-center gap-3 rounded-[var(--radius-sm)] border p-3 transition-colors ${
                    checked
                      ? "border-[#f59e0b55] bg-[#f59e0b0d]"
                      : "border-[var(--color-border-soft)] hover:bg-[var(--color-surface-card)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) =>
                      setExcludedUserIds((current) =>
                        event.target.checked
                          ? [...current, userId]
                          : current.filter((id) => id !== userId),
                      )
                    }
                    className="h-4 w-4 accent-[var(--color-brand-primary)]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-[var(--color-text-primary)]">
                      {profile.full_name}
                    </span>
                    <span className="block truncate text-micro text-[var(--color-text-muted)]">
                      {profile.employee_code}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
