"use client";

import type { AttendanceLateReport } from "@bduck/shared-types";
import { AlertTriangle, Send } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useMemo, useState } from "react";
import { EmployeeAdminBottomSheet } from "../EmployeeAdminBottomSheet";
import { getTodayKey } from "@/utils/attendance";

interface LateArrivalReportSheetProps {
    open: boolean;
    labels: Record<string, string>;
    onClose: () => void;
    onSubmit: (payload: {
        attendance_date?: string;
        expected_arrival_time?: string | null;
        estimated_arrival_time?: string | null;
        reason: string;
    }) => Promise<AttendanceLateReport>;
}

export function LateArrivalReportSheet({
    open,
    labels,
    onClose,
    onSubmit,
}: LateArrivalReportSheetProps) {
    const [attendanceDate, setAttendanceDate] = useState(getTodayKey());
    const [expectedArrivalTime, setExpectedArrivalTime] = useState("");
    const [estimatedArrivalTime, setEstimatedArrivalTime] = useState("");
    const [reason, setReason] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const canSubmit = useMemo(() => reason.trim().length >= 4, [reason]);

    const resetForm = () => {
        setAttendanceDate(getTodayKey());
        setExpectedArrivalTime("");
        setEstimatedArrivalTime("");
        setReason("");
    };

    const handleSubmit = async () => {
        if (!canSubmit || submitting) return;
        setSubmitting(true);
        const task = onSubmit({
            attendance_date: attendanceDate,
            expected_arrival_time: expectedArrivalTime || null,
            estimated_arrival_time: estimatedArrivalTime || null,
            reason: reason.trim(),
        });

        try {
            await gooeyToast.promise(task, {
                loading: labels.lateReportSaving || "Saving late report...",
                success: labels.lateReportSaved || "Late report saved",
                error: labels.lateReportError || "Could not save late report",
                description: {
                    success:
                        labels.lateReportSavedDesc ||
                        "The late arrival reason was added to attendance.",
                    error:
                        labels.lateReportErrorDesc ||
                        "Check the information and try again.",
                },
                action: {
                    error: {
                        label: labels.retry || "Retry",
                        onClick: () => void handleSubmit(),
                    },
                },
            });
            resetForm();
            onClose();
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <EmployeeAdminBottomSheet
            open={open}
            title={labels.lateReportTitle || "Late arrival report"}
            description={labels.lateReportHint}
            onClose={onClose}
        >
            <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-2xl bg-[#f59e0b10] px-3 py-2 text-xs text-[#936000]">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <p>{labels.lateReportHint}</p>
                </div>

                <label className="block">
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                        {labels.calendar}
                    </span>
                    <input
                        type="date"
                        value={attendanceDate}
                        onChange={(event) => setAttendanceDate(event.target.value)}
                        className="mt-1 h-11 w-full rounded-2xl border border-[var(--color-border-soft)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
                    />
                </label>

                <div className="grid grid-cols-2 gap-2">
                    <label className="block">
                        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                            {labels.expectedArrivalTime || "Expected"}
                        </span>
                        <input
                            type="time"
                            value={expectedArrivalTime}
                            onChange={(event) => setExpectedArrivalTime(event.target.value)}
                            className="mt-1 h-11 rounded-2xl border border-[var(--color-border-soft)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                            {labels.estimatedArrivalTime || "Arrival"}
                        </span>
                        <input
                            type="time"
                            value={estimatedArrivalTime}
                            onChange={(event) => setEstimatedArrivalTime(event.target.value)}
                            className="mt-1 h-11 rounded-2xl border border-[var(--color-border-soft)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
                        />
                    </label>
                </div>

                <label className="block">
                    <span className="text-xs font-semibold text-[var(--color-text-secondary)]">
                        {labels.lateReason || "Reason"}
                    </span>
                    <textarea
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                        rows={4}
                        placeholder={labels.lateReasonPlaceholder}
                        className="mt-1 w-full resize-none rounded-2xl border border-[var(--color-border-soft)] bg-white px-3 py-2 text-sm outline-none focus:border-[var(--color-brand-primary)]"
                    />
                </label>

                <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={!canSubmit || submitting}
                    className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-2xl bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white shadow-sm transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--color-text-muted)] disabled:opacity-70"
                >
                    <Send size={16} />
                    <span>{labels.submitLateReport || "Submit late report"}</span>
                </button>
            </div>
        </EmployeeAdminBottomSheet>
    );
}
