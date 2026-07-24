"use client";

import type {
  LeavePolicy,
  UpsertLeavePolicyInput,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { useEffect, useState } from "react";

export function LeavePolicyManager({
  labels,
  policy,
  loading,
  error,
  onSave,
}: {
  labels: Record<string, string>;
  policy: LeavePolicy | null;
  loading: boolean;
  error: string | null;
  onSave: (input: UpsertLeavePolicyInput) => Promise<unknown>;
}) {
  const [monthlyUnits, setMonthlyUnits] = useState(1);
  const [annualCap, setAnnualCap] = useState(12);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMonthlyUnits(policy?.monthly_accrual_units ?? 1);
    setAnnualCap(policy?.annual_cap_units ?? 12);
  }, [policy]);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    const action = () =>
      onSave({
        monthly_accrual_units: monthlyUnits,
        annual_cap_units: annualCap,
        action_time: new Date(),
      });
    try {
      await gooeyToast.promise(action(), {
        loading: labels.leavePolicySaving,
        success: labels.leavePolicySaved,
        error: labels.leaveAdministrationSaveError,
        description: {
          success: labels.leavePolicySavedHint,
          error: labels.leaveAdministrationSaveErrorHint,
        },
        action: {
          error: {
            label: labels.retry,
            onClick: () => void handleSave(),
          },
        },
      });
    } catch (saveError) {
      console.error("[LeavePolicyManager] save error:", saveError);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-[var(--color-surface-card)]" />;
  }
  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-2xl bg-red-50 p-3 text-xs text-red-700">{error}</p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {labels.monthlyAccrualUnits}
          </span>
          <input
            type="number"
            min="0.5"
            max="31"
            step="0.5"
            value={monthlyUnits}
            disabled={isSaving}
            onChange={(event) => setMonthlyUnits(Number(event.target.value))}
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-border-soft)] px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
          />
        </label>
        <label className="block">
          <span className="text-xs font-medium text-[var(--color-text-secondary)]">
            {labels.annualLeaveCap}
          </span>
          <input
            type="number"
            min="1"
            max="365"
            step="0.5"
            value={annualCap}
            disabled={isSaving}
            onChange={(event) => setAnnualCap(Number(event.target.value))}
            className="mt-1 h-11 w-full rounded-xl border border-[var(--color-border-soft)] px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
          />
        </label>
      </div>
      <div className="rounded-2xl bg-[var(--color-surface-card)] p-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
        {labels.leavePolicyFixedRules}
      </div>
      <button
        type="button"
        disabled={
          isSaving ||
          !Number.isFinite(monthlyUnits) ||
          !Number.isFinite(annualCap) ||
          monthlyUnits <= 0 ||
          annualCap <= 0
        }
        onClick={() => void handleSave()}
        className="h-11 w-full rounded-2xl bg-[var(--color-brand-primary)] text-sm font-semibold text-white disabled:opacity-50"
      >
        {labels.saveLeavePolicy}
      </button>
    </div>
  );
}
