"use client";

import type {
  EmployeeProfile,
  LeaveBalanceSummary,
  ManualLeaveBalanceAdjustmentInput,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { useEffect, useMemo, useRef, useState } from "react";
import { LeaveBalanceAdjustmentMetric } from "./LeaveBalanceAdjustmentMetric";

const today = () => new Date().toISOString().slice(0, 10);

export function LeaveBalanceAdjustmentManager({
  labels,
  profiles,
  loading,
  error,
  onLoadBalance,
  onAdjust,
}: {
  labels: Record<string, string>;
  profiles: EmployeeProfile[];
  loading: boolean;
  error: string | null;
  onLoadBalance: (profileId: string) => Promise<LeaveBalanceSummary>;
  onAdjust: (
    profileId: string,
    input: ManualLeaveBalanceAdjustmentInput,
  ) => Promise<unknown>;
}) {
  const [profileId, setProfileId] = useState("");
  const [summary, setSummary] = useState<LeaveBalanceSummary | null>(null);
  const [leaveYear, setLeaveYear] = useState(new Date().getFullYear());
  const [postingDate, setPostingDate] = useState(today());
  const [delta, setDelta] = useState(0.5);
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === profileId) ?? null,
    [profileId, profiles],
  );

  useEffect(() => {
    idempotencyKeyRef.current = null;
    setSummary(null);
    if (!profileId) return;
    let active = true;
    setIsBusy(true);
    void onLoadBalance(profileId)
      .then((result) => {
        if (active) setSummary(result);
      })
      .catch((loadError) =>
        console.error("[LeaveBalanceAdjustmentManager] balance error:", loadError),
      )
      .finally(() => {
        if (active) setIsBusy(false);
      });
    return () => {
      active = false;
    };
  }, [onLoadBalance, profileId]);

  const handleAdjust = async () => {
    if (isBusy || !profileId || !reason.trim() || delta === 0) return;
    setIsBusy(true);
    idempotencyKeyRef.current ??= crypto.randomUUID();
    const input: ManualLeaveBalanceAdjustmentInput = {
      idempotency_key: idempotencyKeyRef.current,
      leave_year: leaveYear,
      posting_date: postingDate,
      available_units_delta: delta,
      reason: reason.trim(),
      action_time: new Date(),
    };
    try {
      await gooeyToast.promise(onAdjust(profileId, input), {
        loading: labels.adjustingLeaveBalance,
        success: labels.leaveBalanceAdjusted,
        error: labels.leaveAdministrationSaveError,
        description: {
          success: labels.leaveBalanceAdjustedHint,
          error: labels.leaveAdministrationSaveErrorHint,
        },
        action: {
          error: {
            label: labels.retry,
            onClick: () => void handleAdjust(),
          },
        },
      });
      setSummary(await onLoadBalance(profileId));
      idempotencyKeyRef.current = null;
      setReason("");
    } catch (adjustError) {
      console.error("[LeaveBalanceAdjustmentManager] adjust error:", adjustError);
    } finally {
      setIsBusy(false);
    }
  };

  if (loading) {
    return <div className="h-56 animate-pulse rounded-2xl bg-[var(--color-surface-card)]" />;
  }
  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-2xl bg-red-50 p-3 text-xs text-red-700">{error}</p>
      )}
      <select
        value={profileId}
        disabled={isBusy}
        aria-label={labels.selectEmployee}
        onChange={(event) => {
          idempotencyKeyRef.current = null;
          setProfileId(event.target.value);
        }}
        className="h-11 w-full rounded-xl border border-[var(--color-border-soft)] bg-white px-3 text-sm"
      >
        <option value="">{labels.selectEmployee}</option>
        {profiles.map((profile) => (
          <option key={profile.id} value={profile.id}>
            {profile.employee_code} · {profile.full_name}
          </option>
        ))}
      </select>
      {selectedProfile && (
        <div className="grid grid-cols-3 gap-2">
          <LeaveBalanceAdjustmentMetric
            label={labels.availableLeave}
            value={summary?.available_units}
          />
          <LeaveBalanceAdjustmentMetric
            label={labels.pendingLeave}
            value={summary?.held_units}
          />
          <LeaveBalanceAdjustmentMetric
            label={labels.usedLeave}
            value={summary?.used_units}
          />
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        <input
          type="number"
          min="2000"
          max="2100"
          value={leaveYear}
          disabled={isBusy}
          aria-label={labels.leaveYear}
          onChange={(event) => {
            idempotencyKeyRef.current = null;
            setLeaveYear(Number(event.target.value));
          }}
          className="h-11 rounded-xl border border-[var(--color-border-soft)] px-2 text-xs"
        />
        <input
          type="date"
          value={postingDate}
          disabled={isBusy}
          aria-label={labels.postingDate}
          onChange={(event) => {
            idempotencyKeyRef.current = null;
            setPostingDate(event.target.value);
          }}
          className="h-11 rounded-xl border border-[var(--color-border-soft)] px-2 text-xs"
        />
        <input
          type="number"
          step="0.5"
          min="-365"
          max="365"
          value={delta}
          disabled={isBusy}
          aria-label={labels.adjustmentUnits}
          onChange={(event) => {
            idempotencyKeyRef.current = null;
            setDelta(Number(event.target.value));
          }}
          className="h-11 rounded-xl border border-[var(--color-border-soft)] px-2 text-xs"
        />
      </div>
      <textarea
        rows={3}
        value={reason}
        maxLength={1000}
        disabled={isBusy}
        placeholder={labels.adjustmentReason}
        onChange={(event) => {
          idempotencyKeyRef.current = null;
          setReason(event.target.value);
        }}
        className="w-full resize-none rounded-2xl border border-[var(--color-border-soft)] p-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
      />
      <button
        type="button"
        disabled={isBusy || !profileId || !reason.trim() || delta === 0}
        onClick={() => void handleAdjust()}
        className="h-11 w-full rounded-2xl bg-[var(--color-brand-primary)] text-sm font-semibold text-white disabled:opacity-50"
      >
        {labels.confirmLeaveAdjustment}
      </button>
    </div>
  );
}
