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

const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
};

const getAvatarBg = (name: string) => {
    const colors = [
        "bg-[#0066cc10] text-[#0066cc]",
        "bg-[#257a3e10] text-[#257a3e]",
        "bg-[#93600010] text-[#936000]",
        "bg-[#7928ca10] text-[#7928ca]",
        "bg-[#ff007f10] text-[#ff007f]",
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
};

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
            <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#0066cc10] text-[#0066cc]">
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
                    className="h-8 min-w-52 rounded-full border border-[var(--color-border-subtle)] bg-white px-3 text-xs outline-none focus:border-[var(--color-brand-primary)]"
                >
                    {warehouses.map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                            {warehouse.name}
                        </option>
                    ))}
                </select>
            </div>

            <div className="grid gap-4 p-4 xl:grid-cols-[360px_minmax(0,1fr)] bg-slate-50/20">
                <div className="rounded-xl border border-[var(--color-border-soft)] p-4 shadow-sm flex flex-col justify-between">
                    <div>
                        <label className="mb-4 flex items-center justify-between gap-3 cursor-pointer">
                            <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                                {labels.enableAttendance}
                            </span>
                            <input
                                type="checkbox"
                                checked={enabled}
                                onChange={(event) => setEnabled(event.target.checked)}
                                className="h-5 w-5 accent-[var(--color-brand-primary)] cursor-pointer rounded"
                            />
                        </label>

                        <div className="grid gap-2">
                            <p className="text-xs font-semibold text-[var(--color-text-secondary)]">
                                {labels.allowedIps}
                            </p>
                            <div className="flex flex-col gap-2 max-h-52 overflow-y-auto pr-1 scrollbar-thin">
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
                                            className="h-8 min-w-0 flex-1 rounded-full border border-[var(--color-border-subtle)] bg-white px-3 text-xs outline-none focus:border-[var(--color-brand-primary)]"
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
                                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[#b42318] hover:bg-[#b4231808]"
                                        >
                                            <Trash2 size={15} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button
                                type="button"
                                onClick={() => setIpAddresses((current) => [...current, ""])}
                                className="inline-flex h-8 w-fit items-center gap-1.5 rounded-full border border-[var(--color-border-subtle)] bg-slate-50 hover:bg-slate-100/50 px-3 text-xs font-semibold text-[var(--color-text-primary)] transition-all active:scale-[0.98]"
                            >
                                <Plus size={14} />
                                {labels.addIp}
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => void handlePolicySave()}
                        className="mt-6 inline-flex h-8 w-full items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-hover)] text-xs font-semibold text-white transition-all active:scale-[0.98]"
                    >
                        <Save size={15} />
                        {labels.saveSettings}
                    </button>
                </div>

                <div className="rounded-xl border border-[var(--color-border-soft)] p-4 bg-white shadow-sm flex flex-col justify-between">
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
                            className="inline-flex h-8 items-center gap-2 rounded-full bg-[#257a3e] hover:bg-[#1e6031] px-4 text-xs font-semibold text-white transition-all active:scale-[0.98]"
                        >
                            <Save size={14} />
                            {labels.save}
                        </button>
                    </div>

                    <div className="grid max-h-72 gap-2 overflow-auto sm:grid-cols-2 scrollbar-thin pr-1 p-0.5">
                        {warehouseProfiles.map((profile) => {
                            const userId = profile.user_id || "";
                            const checked = excludedUserIds.includes(userId);
                            return (
                                <label
                                    key={profile.id}
                                    className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 transition-all ${checked
                                        ? "border-[#f59e0b55] bg-[#f59e0b05]"
                                        : "border-[var(--color-border-soft)] bg-white hover:bg-slate-50/50"
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
                                        className="h-4 w-4 accent-[var(--color-brand-primary)] cursor-pointer rounded"
                                    />
                                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xxs font-bold ${getAvatarBg(profile.full_name)}`}>
                                        {getInitials(profile.full_name)}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <span className="block truncate text-xs font-semibold text-[var(--color-text-primary)]">
                                            {profile.full_name}
                                        </span>
                                        <span className="block truncate text-micro text-[var(--color-text-muted)] font-mono">
                                            {profile.employee_code}
                                        </span>
                                    </div>
                                </label>
                            );
                        })}
                    </div>
                </div>
            </div>
        </motion.section>
    );
}
