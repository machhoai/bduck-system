"use client";

import { ShieldCheck, UsersRound } from "lucide-react";
import type {
  OfficeScopeMode,
  OfficeScopeSnapshot,
  OfficeScopeFacilityOption,
} from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import { OfficeScopePreview } from "./OfficeScopePreview";

interface OfficeScopeSummaryProps {
  scope: OfficeScopeSnapshot | null;
  mode: OfficeScopeMode;
  facilities: OfficeScopeFacilityOption[];
  previewIds: string[];
  canWrite: boolean;
  isSystemAdmin: boolean;
  canUseAll: boolean;
  onModeChange: (mode: OfficeScopeMode) => void;
}

export function OfficeScopeSummary({
  scope,
  mode,
  facilities,
  previewIds,
  canWrite,
  isSystemAdmin,
  canUseAll,
  onModeChange,
}: OfficeScopeSummaryProps) {
  const { t } = useTranslation();
  return (
    <section className="rounded-[var(--radius-lg)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-elevated)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-[var(--color-text-primary)]">
            {t.officeScope.title}
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">
            {t.officeScope.description}
          </p>
        </div>
        <span className="w-fit rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-1 text-xs text-[var(--color-text-secondary)]">
          {t.officeScope.revision}: {scope?.config?.revision ?? 0}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ModeCard
          checked={mode === "ALL"}
          disabled={!canWrite || !canUseAll}
          title={t.officeScope.allMode}
          hint={t.officeScope.allModeHint}
          onSelect={() => onModeChange("ALL")}
        />
        <ModeCard
          checked={mode === "SELECTED"}
          disabled={!canWrite}
          title={t.officeScope.selectedMode}
          hint={t.officeScope.selectedModeHint}
          onSelect={() => onModeChange("SELECTED")}
        />
      </div>
      {!isSystemAdmin && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          {t.officeScope.delegatedWriteHint}
        </p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Metric
          icon={ShieldCheck}
          label={t.officeScope.effectiveScope}
          value={previewIds.length}
        />
        <Metric
          icon={UsersRound}
          label={t.officeScope.affectedEmployees}
          value={scope?.affected_employee_count ?? 0}
        />
      </div>
      <OfficeScopePreview facilityIds={previewIds} facilities={facilities} />
    </section>
  );
}

function ModeCard({
  checked,
  disabled,
  title,
  hint,
  onSelect,
}: {
  checked: boolean;
  disabled: boolean;
  title: string;
  hint: string;
  onSelect: () => void;
}) {
  return (
    <label
      className={`rounded-[var(--radius-md)] border p-3 ${checked ? "border-[var(--color-brand-primary)] bg-[var(--color-surface-pearl)]" : "border-[var(--color-border-subtle)] bg-white"} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
        <input
          type="radio"
          checked={checked}
          disabled={disabled}
          onChange={onSelect}
        />
        {title}
      </span>
      <span className="mt-1 block pl-6 text-xs leading-5 text-[var(--color-text-muted)]">
        {hint}
      </span>
    </label>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof ShieldCheck;
  label: string;
  value: number;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3">
      <Icon size={18} className="text-[var(--color-brand-primary)]" />
      <div>
        <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
        <p className="text-lg font-bold text-[var(--color-text-primary)]">
          {value}
        </p>
      </div>
    </div>
  );
}
