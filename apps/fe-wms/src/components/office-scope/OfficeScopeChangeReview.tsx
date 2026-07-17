"use client";

import { AlertTriangle, Check, Plus, X } from "lucide-react";
import type {
  OfficeScopeFacilityOption,
  OfficeScopeMode,
} from "@bduck/shared-types";
import { useTranslation } from "@/lib/i18n";
import type { OfficeScopeDraftSummary } from "@/utils/officeScopeDraft";

interface OfficeScopeChangeReviewProps {
  isOpen: boolean;
  mode: OfficeScopeMode;
  summary: OfficeScopeDraftSummary;
  facilities: OfficeScopeFacilityOption[];
  affectedEmployeeCount: number;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function OfficeScopeChangeReview({
  isOpen,
  mode,
  summary,
  facilities,
  affectedEmployeeCount,
  isSaving,
  onCancel,
  onConfirm,
}: OfficeScopeChangeReviewProps) {
  const { t } = useTranslation();
  if (!isOpen) return null;
  const facilitiesById = new Map(
    facilities.map((facility) => [facility.id, facility]),
  );
  const names = (ids: string[]) =>
    ids.map((id) => facilitiesById.get(id)?.name ?? id);
  const removedNames = names(summary.removedIds);
  const addedNames = names(summary.addedIds);
  const hasRevocationImpact =
    removedNames.length > 0 && affectedEmployeeCount > 0;

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-slate-950/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="office-scope-review-title"
        className="max-h-[88vh] w-full overflow-y-auto rounded-t-[var(--radius-lg)] bg-white p-4 shadow-2xl sm:max-w-xl sm:rounded-[var(--radius-lg)] sm:p-5"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3
              id="office-scope-review-title"
              className="text-base font-semibold text-[var(--color-text-primary)]"
            >
              {t.officeScope.reviewTitle}
            </h3>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">
              {t.officeScope.reviewDescription}
            </p>
          </div>
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-surface-card)] text-[var(--color-text-muted)] disabled:opacity-50"
            aria-label={t.common.cancel}
          >
            <X size={17} />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <ReviewMetric
            label={t.officeScope.nextMode}
            value={t.officeScope.modes[mode]}
          />
          <ReviewMetric
            label={t.officeScope.nextFacilityCount}
            value={String(summary.afterIds.length)}
          />
        </div>

        {hasRevocationImpact && (
          <div className="mt-4 flex gap-3 rounded-[var(--radius-md)] border border-amber-200 bg-amber-50 p-3 text-amber-800">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />
            <p className="text-sm leading-5">
              {t.officeScope.revocationWarning
                .replace("{facilities}", String(removedNames.length))
                .replace("{employees}", String(affectedEmployeeCount))}
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ChangeList
            icon={Plus}
            title={t.officeScope.addedFacilities}
            names={addedNames}
            emptyLabel={t.officeScope.noAddedFacilities}
            tone="positive"
          />
          <ChangeList
            icon={X}
            title={t.officeScope.removedFacilities}
            names={removedNames}
            emptyLabel={t.officeScope.noRemovedFacilities}
            tone="negative"
          />
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={isSaving}
            onClick={onCancel}
            className="h-10 rounded-full border border-[var(--color-border-subtle)] text-sm font-semibold text-[var(--color-text-secondary)] disabled:opacity-50"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={onConfirm}
            className="flex h-10 items-center justify-center gap-2 rounded-full bg-[var(--color-brand-primary)] text-sm font-semibold text-white disabled:opacity-50"
          >
            <Check size={16} />
            {isSaving ? t.officeScope.saving : t.officeScope.confirmSave}
          </button>
        </div>
      </section>
    </div>
  );
}

function ReviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-md)] bg-[var(--color-surface-card)] p-3">
      <p className="text-xs text-[var(--color-text-muted)]">{label}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--color-text-primary)]">
        {value}
      </p>
    </div>
  );
}

function ChangeList({
  icon: Icon,
  title,
  names,
  emptyLabel,
  tone,
}: {
  icon: typeof Plus;
  title: string;
  names: string[];
  emptyLabel: string;
  tone: "positive" | "negative";
}) {
  return (
    <section className="rounded-[var(--radius-md)] border border-[var(--color-border-subtle)] p-3">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
        <Icon
          size={15}
          className={tone === "positive" ? "text-emerald-600" : "text-rose-600"}
        />
        {title} ({names.length})
      </h4>
      {names.length === 0 ? (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          {emptyLabel}
        </p>
      ) : (
        <div className="mt-2 flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
          {names.map((name) => (
            <span
              key={name}
              className="rounded-full bg-[var(--color-surface-card)] px-2.5 py-1 text-xs"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
