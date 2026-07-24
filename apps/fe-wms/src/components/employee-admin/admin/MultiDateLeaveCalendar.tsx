"use client";

import {
  LeaveDayPortion,
  type CompanyHoliday,
  type LeaveRequestDaySelection,
} from "@bduck/shared-types";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

const portions = [
  { value: LeaveDayPortion.FULL_DAY, label: "fullDay" },
  { value: LeaveDayPortion.MORNING, label: "morning" },
  { value: LeaveDayPortion.AFTERNOON, label: "afternoon" },
] as const;

const toLocalDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const buildCalendarDays = (month: Date) => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
};

export function MultiDateLeaveCalendar({
  labels,
  days,
  holidays,
  disabled,
  onChange,
}: {
  labels: Record<string, string>;
  days: LeaveRequestDaySelection[];
  holidays: CompanyHoliday[];
  disabled: boolean;
  onChange: (days: LeaveRequestDaySelection[]) => void;
}) {
  const [month, setMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const holidayDates = useMemo(
    () => new Set(holidays.map((holiday) => holiday.holiday_date)),
    [holidays],
  );
  const selectedDates = useMemo(
    () => new Set(days.map((day) => day.date).filter(Boolean)),
    [days],
  );
  const calendarDays = useMemo(() => buildCalendarDays(month), [month]);
  const selectedDays = useMemo(
    () => [...days].filter((day) => day.date).sort((a, b) => a.date.localeCompare(b.date)),
    [days],
  );

  const toggleDate = (date: Date) => {
    const value = toLocalDate(date);
    if (selectedDates.has(value)) {
      onChange(days.filter((day) => day.date !== value));
      return;
    }
    if (days.length >= 31) return;
    onChange([
      ...days.filter((day) => day.date),
      { date: value, portion: LeaveDayPortion.FULL_DAY },
    ]);
  };

  const updatePortion = (date: string, portion: LeaveDayPortion) => {
    onChange(
      days.map((day) => (day.date === date ? { ...day, portion } : day)),
    );
  };

  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-[var(--color-border-soft)] bg-white p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={disabled}
            aria-label={labels.previousMonth}
            onClick={() =>
              setMonth(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() - 1, 1),
              )
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-[var(--color-surface-card)] disabled:opacity-50"
          >
            <ChevronLeft size={16} />
          </button>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {labels.calendarMonthLabel
              .replace("{month}", String(month.getMonth() + 1))
              .replace("{year}", String(month.getFullYear()))}
          </p>
          <button
            type="button"
            disabled={disabled}
            aria-label={labels.nextMonth}
            onClick={() =>
              setMonth(
                (current) =>
                  new Date(current.getFullYear(), current.getMonth() + 1, 1),
              )
            }
            className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-[var(--color-surface-card)] disabled:opacity-50"
          >
            <ChevronRight size={16} />
          </button>
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-[var(--color-text-muted)]">
          {labels.calendarWeekdays.split(",").map((weekday) => (
            <span key={weekday}>{weekday}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {calendarDays.map((date) => {
            const value = toLocalDate(date);
            const currentMonth = date.getMonth() === month.getMonth();
            const weekend = date.getDay() === 0 || date.getDay() === 6;
            const holiday = holidayDates.has(value);
            const selected = selectedDates.has(value);
            return (
              <button
                key={value}
                type="button"
                aria-pressed={selected}
                aria-label={value}
                title={holiday ? labels.companyHoliday : undefined}
                disabled={disabled || weekend || holiday}
                onClick={() => toggleDate(date)}
                className={`aspect-square rounded-xl text-xs font-medium transition ${
                  selected
                    ? "bg-[var(--color-brand-primary)] text-white"
                    : currentMonth
                      ? "text-[var(--color-text-primary)] hover:bg-[var(--color-surface-card)]"
                      : "text-[var(--color-text-muted)] opacity-45"
                } disabled:bg-slate-50 disabled:text-slate-300`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
      </div>
      {selectedDays.length === 0 ? (
        <p className="rounded-2xl bg-[var(--color-surface-card)] p-3 text-xs text-[var(--color-text-muted)]">
          {labels.selectLeaveDatesHint}
        </p>
      ) : (
        <div className="space-y-2">
          {selectedDays.map((day) => (
            <div
              key={day.date}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)_40px] items-center gap-2 rounded-xl bg-[var(--color-surface-card)] p-2"
            >
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                {day.date}
              </span>
              <select
                value={day.portion}
                disabled={disabled}
                aria-label={`${labels.leavePortion} ${day.date}`}
                onChange={(event) =>
                  updatePortion(
                    day.date,
                    event.target.value as LeaveDayPortion,
                  )
                }
                className="h-9 rounded-xl border border-[var(--color-border-soft)] bg-white px-2 text-xs"
              >
                {portions.map((portion) => (
                  <option key={portion.value} value={portion.value}>
                    {labels[portion.label]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={disabled}
                aria-label={labels.removeDate}
                onClick={() =>
                  onChange(days.filter((item) => item.date !== day.date))
                }
                className="flex h-9 items-center justify-center rounded-xl text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
