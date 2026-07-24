"use client";

import {
  LeaveRequestType,
  type CompanyHoliday,
  type CreateLeaveRequestInput,
  type LeaveRequestDaySelection,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { useEffect, useMemo, useState } from "react";
import {
  createEmptyLeaveDay,
  getLeaveSelectionIssue,
  getSelectedLeaveUnits,
} from "./leaveSelection";
import { MultiDateLeaveCalendar } from "./MultiDateLeaveCalendar";

const requestTypes = [
  { value: LeaveRequestType.PAID_ANNUAL, label: "paidLeave" },
  { value: LeaveRequestType.UNPAID, label: "unpaidLeave" },
  { value: LeaveRequestType.MATERNITY, label: "maternityLeave" },
  { value: LeaveRequestType.SICK, label: "sickLeave" },
] as const;
interface AdminRequestDraftProps {
  labels: Record<string, string>;
  initialType: LeaveRequestType;
  holidays: CompanyHoliday[];
  onCreate: (input: CreateLeaveRequestInput) => Promise<unknown>;
  onCompleted: () => void;
}

export function AdminRequestDraft({
  labels,
  initialType,
  holidays,
  onCreate,
  onCompleted,
}: AdminRequestDraftProps) {
  const [requestType, setRequestType] = useState(initialType);
  const [days, setDays] = useState<LeaveRequestDaySelection[]>([
    createEmptyLeaveDay(),
  ]);
  const [reason, setReason] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const holidayDates = useMemo(
    () => new Set(holidays.map((holiday) => holiday.holiday_date)),
    [holidays],
  );
  const units = getSelectedLeaveUnits(days);

  useEffect(() => setRequestType(initialType), [initialType]);

  const handleSubmit = async (submit: boolean) => {
    if (isSaving) return;
    const issue = getLeaveSelectionIssue(days, holidayDates);
    if (issue) {
      gooeyToast.error(labels.invalidLeaveSelection, {
        description: labels[issue],
        preset: "snappy",
      });
      return;
    }
    if (!reason.trim()) {
      gooeyToast.error(labels.reasonRequired, {
        description: labels.reasonRequiredHint,
        preset: "snappy",
      });
      return;
    }
    const action = () =>
      onCreate({
        request_type: requestType,
        days,
        reason: reason.trim(),
        submit,
        action_time: new Date(),
      });
    setIsSaving(true);
    try {
      await gooeyToast.promise(action(), {
        loading: submit ? labels.submittingRequest : labels.savingDraft,
        success: submit ? labels.submitRequestSuccess : labels.saveDraftSuccess,
        error: labels.leaveRequestSaveError,
        description: {
          success: submit
            ? labels.submitRequestSuccessHint
            : labels.saveDraftSuccessHint,
          error: labels.leaveRequestSaveErrorHint,
        },
        action: {
          error: {
            label: labels.retry,
            onClick: () => void handleSubmit(submit),
          },
        },
      });
      setDays([createEmptyLeaveDay()]);
      setReason("");
      onCompleted();
    } catch (error) {
      console.error("[AdminRequestDraft] save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <label className="block">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {labels.requestType}
        </span>
        <select
          value={requestType}
          disabled={isSaving}
          onChange={(event) =>
            setRequestType(event.target.value as LeaveRequestType)
          }
          className="mt-1 h-11 w-full rounded-2xl border border-[var(--color-border-soft)] bg-white px-3 text-sm font-medium text-[var(--color-text-primary)] outline-none focus:border-[var(--color-brand-primary)]"
        >
          {requestTypes.map((item) => (
            <option key={item.value} value={item.value}>
              {labels[item.label]}
            </option>
          ))}
        </select>
      </label>

      <section className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold text-[var(--color-text-primary)]">
              {labels.selectedLeaveDates}
            </p>
            <p className="text-[11px] text-[var(--color-text-muted)]">
              {labels.leaveDateRule}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--color-brand-primary-muted)] px-2.5 py-1 text-xs font-semibold text-[var(--color-brand-primary)]">
            {labels.totalLeaveUnits.replace("{units}", String(units))}
          </span>
        </div>

        <div className="mt-3">
          <MultiDateLeaveCalendar
            labels={labels}
            days={days}
            holidays={holidays}
            disabled={isSaving}
            onChange={setDays}
          />
        </div>
      </section>

      <label className="block">
        <span className="text-xs font-medium text-[var(--color-text-secondary)]">
          {labels.reason}
        </span>
        <textarea
          rows={3}
          value={reason}
          disabled={isSaving}
          onChange={(event) => setReason(event.target.value)}
          maxLength={1000}
          className="mt-1 w-full resize-none rounded-2xl border border-[var(--color-border-soft)] px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-primary)]"
          placeholder={labels.reasonPlaceholder}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSubmit(false)}
          className="h-11 rounded-2xl border border-[var(--color-border-soft)] bg-white text-sm font-semibold text-[var(--color-text-primary)] disabled:opacity-50"
        >
          {labels.saveDraft}
        </button>
        <button
          type="button"
          disabled={isSaving}
          onClick={() => void handleSubmit(true)}
          className="h-11 rounded-2xl bg-[var(--color-brand-primary)] text-sm font-semibold text-white disabled:opacity-50"
        >
          {labels.submitRequest}
        </button>
      </div>
    </div>
  );
}
