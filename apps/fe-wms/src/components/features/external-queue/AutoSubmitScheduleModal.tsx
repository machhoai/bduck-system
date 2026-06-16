"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, Plus, Save, Trash2, X } from "lucide-react";
import { gooeyToast } from "goey-toast";
import {
    externalQueueApi,
    type ExternalQueueAutoSubmitSchedule,
} from "../../../api/externalQueueApi";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

type Props = {
    schedule: ExternalQueueAutoSubmitSchedule | null;
    onClose: () => void;
    onSaved: (schedule: ExternalQueueAutoSubmitSchedule) => void;
};

const normalizeTimes = (times: string[]) =>
    Array.from(new Set(times.map((time) => time.trim()).filter(Boolean))).sort();

export default function AutoSubmitScheduleModal({
    schedule,
    onClose,
    onSaved,
}: Props) {
    const [enabled, setEnabled] = useState(schedule?.enabled ?? true);
    const [times, setTimes] = useState<string[]>(
        schedule?.times?.length ? schedule.times : ["16:00", "22:00"],
    );
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setEnabled(schedule?.enabled ?? true);
        setTimes(schedule?.times?.length ? schedule.times : ["14:00", "22:00"]);
    }, [schedule]);

    const normalizedTimes = useMemo(() => normalizeTimes(times), [times]);
    const hasInvalidTime = times.some((time) => !TIME_PATTERN.test(time));
    const hasDuplicateTime =
        normalizedTimes.length !== times.filter(Boolean).length;
    const canSave =
        times.length > 0 && !hasInvalidTime && !hasDuplicateTime && !isSaving;

    const updateTime = (index: number, value: string) => {
        setTimes((current) =>
            current.map((time, itemIndex) => (itemIndex === index ? value : time)),
        );
    };

    const addTime = () => {
        setTimes((current) => [...current, "14:00"]);
    };

    const removeTime = (index: number) => {
        setTimes((current) =>
            current.filter((_, itemIndex) => itemIndex !== index),
        );
    };

    const handleSave = async () => {
        if (!canSave) return;
        setIsSaving(true);
        try {
            const response = await externalQueueApi.updateAutoSubmitSchedule({
                enabled,
                times: normalizedTimes,
            });
            onSaved(response.data);
            gooeyToast.success("Da cap nhat lich auto-submit");
            onClose();
        } catch (error) {
            console.error("[AutoSubmitScheduleModal] save error", error);
            gooeyToast.error("Khong the cap nhat lich auto-submit");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
            <div className="w-full max-w-4xl rounded-lg bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-[var(--color-border-subtle)] px-5 py-4">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
                            <Clock3 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="truncate text-base font-bold text-[var(--color-text-primary)]">
                                Cai gio auto-submit
                            </h2>
                            <p className="mt-0.5 text-sm text-[var(--color-text-muted)]">
                                Mui gio GMT+7
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="flex h-9 w-9 items-center justify-center rounded-md text-[var(--color-text-muted)] transition hover:bg-[var(--color-neutral-100)] hover:text-[var(--color-text-primary)] disabled:opacity-50"
                        aria-label="Dong"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                <div className="space-y-4 px-5 py-4">
                    <div className="flex items-center justify-between gap-4 rounded-md border border-[var(--color-border-subtle)] px-4 py-3">
                        <div>
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                Trang thai
                            </p>
                            <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                                {enabled ? "Dang bat lich tu dong" : "Dang tat lich tu dong"}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setEnabled((value) => !value)}
                            className={`relative h-7 w-12 rounded-full transition ${enabled ? "bg-[var(--color-brand-primary)]" : "bg-[var(--color-neutral-300)]"}`}
                            aria-pressed={enabled}
                        >
                            <span
                                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${enabled ? "left-6" : "left-1"}`}
                            />
                        </button>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                                Gio submit
                            </p>
                            <button
                                type="button"
                                onClick={addTime}
                                disabled={isSaving || times.length >= 24}
                                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-[var(--color-border-subtle)] px-2.5 text-xs font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-neutral-50)] disabled:opacity-50"
                            >
                                <Plus className="h-4 w-4" />
                                Them gio
                            </button>
                        </div>

                        <div className="max-h-72 space-y-2 overflow-auto pr-1">
                            {times.map((time, index) => (
                                <div
                                    key={`${time}-${index}`}
                                    className="flex items-center gap-2"
                                >
                                    <input
                                        type="time"
                                        value={time}
                                        onChange={(event) => updateTime(index, event.target.value)}
                                        disabled={isSaving}
                                        className="h-10 flex-1 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-neutral-50)] px-3 text-sm font-semibold text-[var(--color-text-primary)] outline-none transition focus:border-[var(--color-border-focus)] focus:ring-2 focus:ring-[var(--color-brand-primary-muted)] disabled:opacity-50"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => removeTime(index)}
                                        disabled={isSaving || times.length === 1}
                                        className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--color-border-subtle)] text-[var(--color-text-muted)] transition hover:border-[var(--color-error-border)] hover:bg-[var(--color-error-bg)] hover:text-[var(--color-error-icon)] disabled:opacity-40"
                                        aria-label="Xoa gio"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        {(hasInvalidTime || hasDuplicateTime) && (
                            <p className="text-xs font-medium text-[var(--color-error-icon)]">
                                Vui long chon gio hop le va khong trung nhau.
                            </p>
                        )}
                    </div>
                </div>

                <div className="flex justify-end gap-2 border-t border-[var(--color-border-subtle)] px-5 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-[var(--color-border-subtle)] px-4 text-sm font-semibold text-[var(--color-text-secondary)] transition hover:bg-[var(--color-neutral-50)] disabled:opacity-50"
                    >
                        Huy
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSave}
                        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[var(--color-brand-primary)] px-4 text-sm font-semibold text-white transition hover:bg-[var(--color-brand-primary-hover)] disabled:opacity-50"
                    >
                        {isSaving ? (
                            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        Luu
                    </button>
                </div>
            </div>
        </div>
    );
}
