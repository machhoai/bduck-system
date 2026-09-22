"use client";

import {
  LeaveRequestType,
  type CompanyHoliday,
  type LeaveImportBatchView,
  type LeaveImportEmployeeOption,
  type LeaveRequestDaySelection,
  type PreviewManualLeaveHistoryInput,
} from "@bduck/shared-types";
import { gooeyToast } from "goey-toast";
import { useEffect, useRef, useState } from "react";

import { MultiDateLeaveCalendar } from "./MultiDateLeaveCalendar";
import { SearchableEmployeeSelect } from "./SearchableEmployeeSelect";

type ManualRequestType = PreviewManualLeaveHistoryInput["request_type"];

const requestTypes: ManualRequestType[] = [
  LeaveRequestType.PAID_ANNUAL,
  LeaveRequestType.UNPAID,
  LeaveRequestType.SICK,
  LeaveRequestType.MATERNITY,
];

export function ManualLeaveHistoryForm({
  labels,
  employees,
  holidays,
  disabled,
  fixedEmployee,
  onPreview,
}: {
  labels: Record<string, string>;
  employees: LeaveImportEmployeeOption[];
  holidays: CompanyHoliday[];
  disabled: boolean;
  fixedEmployee?: LeaveImportEmployeeOption;
  onPreview: (
    input: PreviewManualLeaveHistoryInput,
  ) => Promise<LeaveImportBatchView>;
}) {
  const [profileId, setProfileId] = useState(fixedEmployee?.id ?? "");
  const [requestType, setRequestType] = useState<ManualRequestType>(
    LeaveRequestType.PAID_ANNUAL,
  );
  const [days, setDays] = useState<LeaveRequestDaySelection[]>([]);
  const [reason, setReason] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const clientReference = useRef<string | null>(null);
  const cannotPreview =
    disabled || isBusy || !profileId || days.length === 0 || !reason.trim();

  useEffect(() => {
    if (fixedEmployee) setProfileId(fixedEmployee.id);
  }, [fixedEmployee]);

  const createPreview = async () => {
    if (cannotPreview) return;
    clientReference.current ??= crypto.randomUUID();
    const input: PreviewManualLeaveHistoryInput = {
      client_reference: clientReference.current,
      employee_profile_id: profileId,
      request_type: requestType,
      days,
      reason: reason.trim(),
      action_time: new Date(),
    };
    setIsBusy(true);
    try {
      await gooeyToast.promise(onPreview(input), {
        loading: labels.leaveImportManualPreviewing,
        success: labels.leaveImportPreviewReady,
        error: labels.leaveImportPreviewError,
        description: {
          success: labels.leaveImportPreviewReadyHint,
          error: labels.leaveImportRetryHint,
        },
        action: {
          error: {
            label: labels.retry,
            onClick: () => void createPreview(),
          },
        },
      });
      clientReference.current = null;
    } catch (error) {
      console.error("[ManualLeaveHistoryForm] preview error:", error);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--color-border-soft)] p-3">
      <div>
        <p className="text-sm font-semibold text-slate-900">
          {labels.leaveImportManualTitle}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {labels.leaveImportManualHint}
        </p>
      </div>

      {fixedEmployee ? (
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-2.5">
          <p className="text-xs font-medium text-blue-600">
            {labels.selectEmployee}
          </p>
          <p className="mt-0.5 text-sm font-semibold text-slate-900">
            {fixedEmployee.employee_code} · {fixedEmployee.full_name}
          </p>
        </div>
      ) : (
        <SearchableEmployeeSelect
          labels={labels}
          options={employees}
          value={profileId}
          disabled={disabled || isBusy}
          onChange={setProfileId}
        />
      )}

      <label className="block space-y-1">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
          {labels.leaveImportColumnRequestType}
        </span>
        <select
          value={requestType}
          disabled={disabled || isBusy}
          onChange={(event) =>
            setRequestType(event.target.value as ManualRequestType)
          }
          className="h-11 w-full rounded-xl border border-[var(--color-border-soft)] bg-white px-3 text-sm"
        >
          {requestTypes.map((type) => (
            <option key={type} value={type}>
              {labels[`leaveType${type}`]}
            </option>
          ))}
        </select>
      </label>

      <MultiDateLeaveCalendar
        labels={labels}
        days={days}
        holidays={holidays}
        disabled={disabled || isBusy}
        onChange={setDays}
      />

      <textarea
        rows={3}
        value={reason}
        maxLength={500}
        disabled={disabled || isBusy}
        placeholder={labels.leaveImportManualReason}
        onChange={(event) => setReason(event.target.value)}
        className="w-full resize-none rounded-2xl border border-[var(--color-border-soft)] p-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
      />

      <button
        type="button"
        disabled={cannotPreview}
        onClick={() => void createPreview()}
        className="h-11 w-full rounded-xl bg-blue-600 text-sm font-semibold text-white disabled:opacity-50"
      >
        {labels.leaveImportManualPreview}
      </button>
    </section>
  );
}
