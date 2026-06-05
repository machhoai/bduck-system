"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
    AlertTriangle,
    Camera,
    CheckCircle2,
    ChevronRight,
    Clock3,
    GitBranch,
    Save,
    ScanLine,
    ShieldAlert,
    Sparkles,
    Zap,
} from "lucide-react";
import { gooeyToast } from "goey-toast";
import type {
    ApprovalLevel,
    ProcessConfig,
    ProcessEntityType,
    StepOption,
} from "@bduck/shared-types";
import { subscribeDataMutation } from "@/lib/dataInvalidation";
import { useTranslation } from "@/lib/i18n";
import {
    fetchAllConfigs,
    seedProcessConfig,
    updateProcessConfig,
} from "@/hooks/useApprovalApi";
import { useRoles } from "@/hooks/useRoles";
import { ApprovalChainEditor } from "./ApprovalChainEditor";
import { ProcessConfigSkeleton } from "./ProcessConfigSkeleton";
import { StepOptionsEditor } from "./StepOptionsEditor";
import {
    ENTITY_ORDER,
    TEXT,
    getConfigSummary,
    getEntityMeta,
    getEntitySteps,
    type Locale,
} from "./processConfigMeta";

function StatTile({
    label,
    value,
    tone,
}: {
    label: string;
    value: string | number;
    tone: "blue" | "emerald" | "amber";
}) {
    const toneClass = {
        blue: "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]",
        emerald: "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)]",
        amber: "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]",
    }[tone];

    return (
        <div className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
            <p className="line-clamp-2 min-h-7 text-xxs font-semibold leading-3 text-gray-500 sm:min-h-0 sm:text-xs sm:font-medium sm:leading-normal">
                {label}
            </p>
            <p
                className={`mt-2 inline-flex rounded-lg px-2 py-1 text-base font-bold sm:mt-3 sm:px-2.5 sm:text-lg ${toneClass}`}
            >
                {value}
            </p>
        </div>
    );
}

function EntitySelector({
    activeKey,
    configs,
    missingTypes,
    locale,
    onSelect,
}: {
    activeKey: string;
    configs: ProcessConfig[];
    missingTypes: ProcessEntityType[];
    locale: Locale;
    onSelect: (key: string) => void;
}) {
    const copy = TEXT[locale];
    const items = [
        ...configs.map((config) => ({
            key: `config:${config.id}`,
            entityType: config.entity_type,
            config,
        })),
        ...missingTypes.map((entityType) => ({
            key: `missing:${entityType}`,
            entityType,
            config: undefined,
        })),
    ];

    return (
        <aside className="sticky top-[86px] z-20 -mx-4 border-b border-gray-100 bg-white/95 px-4 py-3 backdrop-blur lg:top-4 lg:mx-0 lg:border-b-0 lg:bg-transparent lg:px-0 lg:py-0 lg:self-start">
            <div className="flex snap-x gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:block lg:space-y-2 lg:overflow-visible lg:pb-0 [&::-webkit-scrollbar]:hidden">
                {items.map(({ key, entityType, config }) => {
                    const meta = getEntityMeta(entityType);
                    const Icon = meta.icon;
                    const summary = getConfigSummary(config);
                    const active = activeKey === key;

                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => onSelect(key)}
                            className={`min-w-40 snap-start rounded-lg border bg-white p-3 text-left shadow-sm transition active:scale-[0.98] lg:min-w-0 lg:w-full ${active
                                ? "border-[var(--color-brand-primary)] ring-2 ring-[var(--color-brand-primary-muted)]"
                                : "border-gray-100 hover:border-gray-200 hover:bg-gray-50"
                                }`}
                        >
                            <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:gap-3">
                                <div
                                    className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-lg ${config
                                        ? "bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]"
                                        : "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)]"
                                        }`}
                                >
                                    <Icon className="h-5 w-5" />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="line-clamp-2 text-sm font-semibold leading-5 text-gray-950 lg:truncate">
                                            {meta.label[locale]}
                                        </p>
                                        <ChevronRight
                                            className={`hidden h-4 w-4 shrink-0 lg:block ${active ? "text-[var(--color-status-approved-text)]" : "text-[var(--color-neutral-300)]"
                                                }`}
                                        />
                                    </div>
                                    <p className="mt-1 hidden text-xs leading-5 text-gray-500 lg:line-clamp-2">
                                        {meta.description[locale]}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5 lg:mt-3 lg:gap-2">
                                        <span
                                            className={`rounded-full px-2 py-1 text-xxs font-semibold ${config
                                                ? "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)]"
                                                : "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]"
                                                }`}
                                        >
                                            {config ? copy.configured : copy.missing}
                                        </span>
                                        {config && (
                                            <span className="rounded-full bg-gray-100 px-2 py-1 text-xxs font-semibold text-gray-600">
                                                {summary.activeLevels} {copy.activeLevels}
                                            </span>
                                        )}
                                        {config?.warehouse_id && (
                                            <span className="rounded-full bg-[var(--color-status-approved-bg)] px-2 py-1 text-xxs font-semibold text-[var(--color-status-approved-text)]">
                                                {copy.warehouseScope}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </aside>
    );
}

function PipelinePreview({
    entityType,
    autoApprove,
    locale,
}: {
    entityType: ProcessEntityType;
    autoApprove: boolean;
    locale: Locale;
}) {
    const copy = TEXT[locale];
    const steps = getEntitySteps(entityType);
    const items = [
        copy.start,
        autoApprove ? copy.autoApprove : copy.approval,
        steps[0]?.label[locale] ?? copy.operation,
        copy.done,
    ];

    return (
        <div className="rounded-lg border border-gray-100 bg-white p-4 sm:bg-gray-50">
            <div className="flex items-start gap-3">
                <GitBranch className="mt-0.5 h-4 w-4 text-gray-500" />
                <div>
                    <p className="text-sm font-semibold text-gray-900">
                        {copy.fixedPipeline}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                        {copy.fixedPipelineHint}
                    </p>
                </div>
            </div>
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-4 sm:overflow-visible sm:pb-0">
                {items.map((item, index) => (
                    <div
                        key={`${item}-${index}`}
                        className="flex min-w-32 items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm sm:min-w-0"
                    >
                        <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xxs ${index === 1 && autoApprove
                                ? "bg-[var(--color-status-pending-bg-muted)] text-[var(--color-status-pending-text)]"
                                : "bg-[var(--color-status-approved-bg-muted)] text-[var(--color-status-approved-text)]"
                                }`}
                        >
                            {index + 1}
                        </span>
                        <span className="min-w-0 truncate">{item}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MissingConfigPanel({
    entityType,
    locale,
    creating,
    onSeed,
}: {
    entityType: ProcessEntityType;
    locale: Locale;
    creating: boolean;
    onSeed: (entityType: ProcessEntityType) => Promise<void>;
}) {
    const copy = TEXT[locale];
    const meta = getEntityMeta(entityType);
    const Icon = meta.icon;

    return (
        <div className="mx-4 mt-4 rounded-lg border border-dashed border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] p-5 lg:mx-0 lg:mt-0 lg:p-4">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex items-start gap-3">
                    <div className="flex h-8 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-elevated)] text-[var(--color-status-pending-text)] shadow-sm">
                        <Icon className="h-5 w-5" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-[var(--color-status-pending-text)]">
                            {meta.label[locale]}
                        </p>
                        <h2 className="mt-1 text-lg font-bold text-gray-950">
                            {copy.missing}
                        </h2>
                        <p className="mt-2 text-sm leading-6 text-[var(--color-status-pending-text)]">
                            {copy.createDefaultHint}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    disabled={creating}
                    onClick={() => onSeed(entityType)}
                    className="inline-flex h-8 items-center justify-center gap-2 rounded-lg bg-gray-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-gray-800 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60 sm:h-8"
                >
                    {creating ? (
                        <Clock3 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Sparkles className="h-4 w-4" />
                    )}
                    {copy.createDefault}
                </button>
            </div>
        </div>
    );
}

function ConfigDetailPanel({
    config,
    locale,
    roles,
    saving,
    onSave,
}: {
    config: ProcessConfig;
    locale: Locale;
    roles: ReturnType<typeof useRoles>["roles"];
    saving: boolean;
    onSave: (
        configId: string,
        payload: {
            approval_chain: ApprovalLevel[];
            auto_approve: boolean;
            require_evidence: boolean;
            require_otp: boolean;
            step_options: Record<string, StepOption>;
        },
    ) => Promise<void>;
}) {
    const copy = TEXT[locale];
    const meta = getEntityMeta(config.entity_type);
    const Icon = meta.icon;
    const [chain, setChain] = useState<ApprovalLevel[]>(config.approval_chain);
    const [autoApprove, setAutoApprove] = useState(config.auto_approve);
    const [requireEvidence, setRequireEvidence] = useState(config.require_evidence ?? false);
    const [requireOtp, setRequireOtp] = useState(config.require_otp ?? false);
    const [stepOptions, setStepOptions] = useState<Record<string, StepOption>>(
        config.step_options,
    );

    useEffect(() => {
        setChain(config.approval_chain);
        setAutoApprove(config.auto_approve);
        setRequireEvidence(config.require_evidence ?? false);
        setRequireOtp(config.require_otp ?? false);
        setStepOptions(config.step_options);
    }, [config]);

    const steps = getEntitySteps(config.entity_type);
    const activeLevels = chain.filter((level) => level.required || level.enabled);

    const validate = () => {
        if (!autoApprove && activeLevels.some((level) => !level.role_id)) {
            gooeyToast.error(copy.invalidRole, {
                preset: "snappy",
                timing: { displayDuration: 4000 },
            });
            return false;
        }

        if (
            chain.some((level) => !level.label.vi.trim() || !level.label.zh.trim())
        ) {
            gooeyToast.error(copy.invalidLabel, {
                preset: "snappy",
                timing: { displayDuration: 4000 },
            });
            return false;
        }

        const invalidStep = steps.find((step) => {
            const option = stepOptions[step.key];
            return option?.assignment_mode === "ROLE" && !option.assigned_role_id;
        });

        if (invalidStep) {
            gooeyToast.error(`${copy.invalidStepRole} ${invalidStep.label[locale]}`, {
                preset: "snappy",
                timing: { displayDuration: 4000 },
            });
            return false;
        }

        return true;
    };

    const handleSave = async () => {
        if (!validate()) return;

        await onSave(config.id, {
            approval_chain: chain,
            auto_approve: autoApprove,
            require_evidence: requireEvidence,
            require_otp: requireOtp,
            step_options: stepOptions,
        });
    };

    return (
        <div className="rounded-lg border border-gray-100 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-gray-100 bg-white p-4 max-lg:mx-4 max-lg:mt-4 max-lg:rounded-lg max-lg:border max-lg:shadow-sm sm:p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex items-start gap-3">
                        <div className="flex h-8 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--color-status-approved-bg)] text-[var(--color-status-approved-text)]">
                            <Icon className="h-6 w-6" />
                        </div>
                        <div>
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-lg font-bold text-gray-950">
                                    {meta.label[locale]}
                                </h1>
                                <span className="rounded-full bg-[var(--color-status-completed-bg)] px-2.5 py-1 text-xs font-semibold text-[var(--color-status-completed-text)]">
                                    {copy.configured}
                                </span>
                            </div>
                            <p className="mt-1 text-sm leading-6 text-gray-500">
                                {meta.description[locale]}
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-gray-600">
                                    {config.warehouse_id ? copy.warehouseScope : copy.globalScope}
                                </span>
                                <span className="rounded-full bg-[var(--color-status-approved-bg)] px-2.5 py-1 text-[var(--color-status-approved-text)]">
                                    {activeLevels.length} {copy.activeLevels}
                                </span>
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving}
                        className="hidden h-8 items-center justify-center gap-2 rounded-lg bg-[var(--color-success-icon)] px-4 text-sm font-semibold text-[var(--color-text-on-dark)] shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 lg:inline-flex"
                    >
                        {saving ? (
                            <Clock3 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {saving ? copy.saving : copy.save}
                    </button>
                </div>
            </div>

            <div className="space-y-4 p-4 pb-28 sm:p-5 lg:pb-5">
                <PipelinePreview
                    entityType={config.entity_type}
                    autoApprove={autoApprove}
                    locale={locale}
                />

                <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div
                                className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-lg ${autoApprove
                                    ? "bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]"
                                    : "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)]"
                                    }`}
                            >
                                <Zap className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-950">
                                    {copy.autoApprove}
                                </p>
                                <p className="mt-1 text-xs leading-5 text-gray-500">
                                    {copy.autoApproveHint}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setAutoApprove((value) => !value)}
                            className={`flex h-8 min-w-28 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition sm:h-8 ${autoApprove
                                ? "bg-[var(--color-status-pending-bg-muted)] text-[var(--color-status-pending-text)] hover:bg-[var(--color-status-pending-border)]"
                                : "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)] hover:bg-[var(--color-neutral-200)]"
                                }`}
                        >
                            {autoApprove ? (
                                <CheckCircle2 className="h-4 w-4" />
                            ) : (
                                <ShieldAlert className="h-4 w-4" />
                            )}
                            {autoApprove ? copy.enabled : copy.disabled}
                        </button>
                    </div>
                    {autoApprove && (
                        <div className="mt-4 flex items-start gap-2 rounded-lg border border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] px-3 py-2 text-xs leading-5 text-[var(--color-status-pending-text)]">
                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-status-pending-icon)]" />
                            {copy.autoApproveWarning}
                        </div>
                    )}
                </section>

                <section className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm space-y-4">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-start gap-3">
                            <div className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-lg ${requireEvidence ? "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)]" : "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"}`}>
                                <Camera className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-950">
                                    {copy.requireEvidence}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setRequireEvidence((value) => !value)}
                            className={`flex h-8 min-w-28 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition sm:h-8 ${requireEvidence
                                ? "bg-[var(--color-status-pending-bg-muted)] text-[var(--color-status-pending-text)] hover:bg-[var(--color-status-pending-border)]"
                                : "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)] hover:bg-[var(--color-neutral-200)]"
                                }`}
                        >
                            {requireEvidence ? (
                                <CheckCircle2 className="h-4 w-4" />
                            ) : (
                                <ShieldAlert className="h-4 w-4" />
                            )}
                            {requireEvidence ? copy.enabled : copy.disabled}
                        </button>
                    </div>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between pt-4 border-t border-gray-100">
                        <div className="flex items-start gap-3">
                            <div className={`flex h-8 w-10 shrink-0 items-center justify-center rounded-lg ${requireOtp ? "bg-[var(--color-status-completed-bg)] text-[var(--color-status-completed-text)]" : "bg-[var(--color-surface-subtle)] text-[var(--color-text-muted)]"}`}>
                                <ScanLine className="h-5 w-5" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-950">
                                    {copy.requireOtp}
                                </p>
                            </div>
                        </div>
                        <button
                            type="button"
                            onClick={() => setRequireOtp((value) => !value)}
                            className={`flex h-8 min-w-28 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold transition sm:h-8 ${requireOtp
                                ? "bg-[var(--color-status-pending-bg-muted)] text-[var(--color-status-pending-text)] hover:bg-[var(--color-status-pending-border)]"
                                : "bg-[var(--color-status-draft-bg)] text-[var(--color-status-draft-text)] hover:bg-[var(--color-neutral-200)]"
                                }`}
                        >
                            {requireOtp ? (
                                <CheckCircle2 className="h-4 w-4" />
                            ) : (
                                <ShieldAlert className="h-4 w-4" />
                            )}
                            {requireOtp ? copy.enabled : copy.disabled}
                        </button>
                    </div>
                </section>

                <ApprovalChainEditor
                    chain={chain}
                    roles={roles}
                    disabled={autoApprove}
                    copy={copy}
                    onChange={setChain}
                />

                <StepOptionsEditor
                    steps={steps}
                    stepOptions={stepOptions}
                    roles={roles}
                    locale={locale}
                    copy={copy}
                    onChange={setStepOptions}
                />
            </div>

            <div className="fixed bottom-[76px] left-0 right-0 z-30 border-t border-gray-100 bg-white/95 px-4 py-3 shadow-[0_-10px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving}
                    className="flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-[var(--color-success-icon)] text-sm font-semibold text-[var(--color-text-on-dark)] shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {saving ? (
                        <Clock3 className="h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="h-4 w-4" />
                    )}
                    {saving ? copy.saving : copy.save}
                </button>
            </div>
        </div>
    );
}

export function ProcessConfigWorkspace() {
    const { lang } = useTranslation();
    const locale = (lang || "vi") as Locale;
    const copy = TEXT[locale];
    const { roles, isLoading: rolesLoading } = useRoles();
    const [configs, setConfigs] = useState<ProcessConfig[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeKey, setActiveKey] = useState("missing:IMPORT_VOUCHER");
    const [savingId, setSavingId] = useState<string | null>(null);
    const [creatingEntity, setCreatingEntity] =
        useState<ProcessEntityType | null>(null);

    const loadConfigs = useCallback(async () => {
        try {
            const data = (await fetchAllConfigs()) as ProcessConfig[];
            setConfigs(data);
        } catch (error) {
            console.error("[ProcessConfigWorkspace] load error:", error);
            gooeyToast.error(copy.loadError, {
                preset: "snappy",
                timing: { displayDuration: 5000 },
            });
        } finally {
            setLoading(false);
        }
    }, [copy.loadError]);

    useEffect(() => {
        void loadConfigs();
        return subscribeDataMutation("process_configs", () => {
            void loadConfigs();
        });
    }, [loadConfigs]);

    const sortedConfigs = useMemo(
        () =>
            [...configs].sort((a, b) => {
                const entityDiff =
                    ENTITY_ORDER.indexOf(a.entity_type) -
                    ENTITY_ORDER.indexOf(b.entity_type);
                if (entityDiff !== 0) return entityDiff;
                return (a.warehouse_id ?? "").localeCompare(b.warehouse_id ?? "");
            }),
        [configs],
    );

    const configuredTypes = useMemo(
        () => new Set(configs.map((config) => config.entity_type)),
        [configs],
    );
    const missingTypes = useMemo(
        () => ENTITY_ORDER.filter((entityType) => !configuredTypes.has(entityType)),
        [configuredTypes],
    );

    const configuredCount = configs.length;
    const missingCount = missingTypes.length;
    const autoApproveCount = configs.filter(
        (config) => config.auto_approve,
    ).length;
    const activeConfig = configs.find(
        (config) => activeKey === `config:${config.id}`,
    );
    const activeMissingEntity = activeKey.startsWith("missing:")
        ? (activeKey.replace("missing:", "") as ProcessEntityType)
        : (missingTypes[0] ?? "IMPORT_VOUCHER");

    useEffect(() => {
        const hasActiveConfig = configs.some(
            (config) => activeKey === `config:${config.id}`,
        );
        const hasActiveMissing =
            activeKey.startsWith("missing:") &&
            missingTypes.includes(
                activeKey.replace("missing:", "") as ProcessEntityType,
            );

        if (hasActiveConfig || hasActiveMissing) return;

        if (sortedConfigs[0]) {
            setActiveKey(`config:${sortedConfigs[0].id}`);
            return;
        }

        setActiveKey(`missing:${missingTypes[0] ?? "IMPORT_VOUCHER"}`);
    }, [activeKey, configs, missingTypes, sortedConfigs]);

    const handleSeed = useCallback(
        async (entityType: ProcessEntityType) => {
            const seedAction = async () => {
                try {
                    setCreatingEntity(entityType);
                    const created = (await seedProcessConfig(
                        entityType,
                    )) as ProcessConfig;
                    setConfigs((current) => {
                        const rest = current.filter((config) => config.id !== created.id);
                        return [...rest, created];
                    });
                    setActiveKey(`config:${created.id}`);
                } catch (error) {
                    console.error("[ProcessConfigWorkspace] seed error:", error);
                    throw error;
                } finally {
                    setCreatingEntity(null);
                }
            };

            await gooeyToast.promise(seedAction(), {
                loading: copy.creating,
                success: copy.createSuccess,
                error: copy.createError,
                description: {
                    error: copy.loadError,
                },
                action: {
                    error: {
                        label: copy.retry,
                        onClick: () => void handleSeed(entityType),
                    },
                },
            });
        },
        [
            copy.createError,
            copy.createSuccess,
            copy.creating,
            copy.loadError,
            copy.retry,
        ],
    );

    const handleSave = useCallback(
        async (
            configId: string,
            payload: {
                approval_chain: ApprovalLevel[];
                auto_approve: boolean;
                require_evidence: boolean;
                require_otp: boolean;
                step_options: Record<string, StepOption>;
            },
        ) => {
            const saveAction = async () => {
                try {
                    setSavingId(configId);
                    const updated = (await updateProcessConfig(
                        configId,
                        payload,
                    )) as ProcessConfig;
                    setConfigs((current) =>
                        current.map((config) =>
                            config.id === configId ? { ...config, ...updated } : config,
                        ),
                    );
                } catch (error) {
                    console.error("[ProcessConfigWorkspace] save error:", error);
                    throw error;
                } finally {
                    setSavingId(null);
                }
            };

            await gooeyToast.promise(saveAction(), {
                loading: copy.saving,
                success: copy.saveSuccess,
                error: copy.saveError,
                description: {
                    success: copy.saveSuccessDesc,
                    error: copy.loadError,
                },
                action: {
                    error: {
                        label: copy.retry,
                        onClick: () => void handleSave(configId, payload),
                    },
                },
            });
        },
        [
            copy.loadError,
            copy.retry,
            copy.saveError,
            copy.saveSuccess,
            copy.saveSuccessDesc,
            copy.saving,
        ],
    );

    if (loading || rolesLoading) {
        return <ProcessConfigSkeleton />;
    }

    return (
        <div className="-mx-4 w-full -mt-2 min-h-[calc(100dvh-80px)] space-y-3 bg-gray-50 pb-28 sm:mx-auto sm:mt-0 sm:bg-transparent sm:pb-0">
            <div className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 px-4 pb-3 pt-4 backdrop-blur sm:static sm:border-b-0 sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-0">
                <h1 className="text-lg font-bold text-gray-950">{copy.title}</h1>
                <p className="mt-1 text-sm leading-6 text-gray-500">{copy.subtitle}</p>
            </div>

            <div className="grid grid-cols-3 gap-2 px-4 sm:gap-3 sm:px-0">
                <StatTile
                    label={copy.configured}
                    value={configuredCount}
                    tone="emerald"
                />
                <StatTile label={copy.missing} value={missingCount} tone="amber" />
                <StatTile
                    label={copy.autoApprove}
                    value={autoApproveCount}
                    tone="blue"
                />
            </div>

            <div className="grid gap-0 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-4">
                <EntitySelector
                    activeKey={activeKey}
                    configs={sortedConfigs}
                    missingTypes={missingTypes}
                    locale={locale}
                    onSelect={setActiveKey}
                />

                {activeConfig ? (
                    <ConfigDetailPanel
                        config={activeConfig}
                        locale={locale}
                        roles={roles}
                        saving={savingId === activeConfig.id}
                        onSave={handleSave}
                    />
                ) : (
                    <MissingConfigPanel
                        entityType={activeMissingEntity}
                        locale={locale}
                        creating={creatingEntity === activeMissingEntity}
                        onSeed={handleSeed}
                    />
                )}
            </div>
        </div>
    );
}
