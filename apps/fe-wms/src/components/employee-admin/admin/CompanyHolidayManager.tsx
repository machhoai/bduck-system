"use client";

import type {
  CompanyHoliday,
  UpsertCompanyHolidayInput,
} from "@bduck/shared-types";
import { CalendarPlus, Trash2 } from "lucide-react";
import { gooeyToast } from "goey-toast";
import { useState } from "react";
import { EmptyState } from "./AdminOverviewParts";

interface CompanyHolidayManagerProps {
  labels: Record<string, string>;
  holidays: CompanyHoliday[];
  onCreate: (input: UpsertCompanyHolidayInput) => Promise<unknown>;
  onRemove: (holidayId: string) => Promise<unknown>;
}

export function CompanyHolidayManager({
  labels,
  holidays,
  onCreate,
  onRemove,
}: CompanyHolidayManagerProps) {
  const [date, setDate] = useState("");
  const [nameVi, setNameVi] = useState("");
  const [nameZh, setNameZh] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const save = async () => {
    if (busyId || !date || !nameVi.trim() || !nameZh.trim()) return;
    const action = () =>
      onCreate({
        holiday_date: date,
        name: { vi: nameVi.trim(), zh: nameZh.trim() },
        action_time: new Date(),
      });
    setBusyId("create");
    try {
      await gooeyToast.promise(action(), {
        loading: labels.savingHoliday,
        success: labels.saveHolidaySuccess,
        error: labels.holidaySaveError,
        description: {
          success: labels.saveHolidaySuccessHint,
          error: labels.holidaySaveErrorHint,
        },
        action: {
          error: {
            label: labels.retry,
            onClick: () => void save(),
          },
        },
      });
      setDate("");
      setNameVi("");
      setNameZh("");
    } catch (error) {
      console.error("[CompanyHolidayManager] save error:", error);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (holidayId: string) => {
    if (busyId) return;
    setBusyId(holidayId);
    try {
      await gooeyToast.promise(onRemove(holidayId), {
        loading: labels.removingHoliday,
        success: labels.removeHolidaySuccess,
        error: labels.holidaySaveError,
        description: {
          success: labels.removeHolidaySuccessHint,
          error: labels.holidaySaveErrorHint,
        },
        action: {
          error: {
            label: labels.retry,
            onClick: () => void remove(holidayId),
          },
        },
      });
    } catch (error) {
      console.error("[CompanyHolidayManager] remove error:", error);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-[var(--color-border-soft)] bg-[var(--color-surface-card)] p-3">
        <div className="flex items-center gap-2">
          <CalendarPlus
            size={16}
            className="text-[var(--color-brand-primary)]"
          />
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {labels.addCompanyHoliday}
          </p>
        </div>
        <div className="mt-3 grid gap-2">
          <input
            type="date"
            value={date}
            disabled={Boolean(busyId)}
            aria-label={labels.holidayDate}
            onChange={(event) => setDate(event.target.value)}
            className="h-11 rounded-xl border border-[var(--color-border-soft)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
          />
          <input
            value={nameVi}
            disabled={Boolean(busyId)}
            maxLength={120}
            onChange={(event) => setNameVi(event.target.value)}
            placeholder={labels.holidayNameVi}
            className="h-11 rounded-xl border border-[var(--color-border-soft)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
          />
          <input
            value={nameZh}
            disabled={Boolean(busyId)}
            maxLength={120}
            onChange={(event) => setNameZh(event.target.value)}
            placeholder={labels.holidayNameZh}
            className="h-11 rounded-xl border border-[var(--color-border-soft)] bg-white px-3 text-sm outline-none focus:border-[var(--color-brand-primary)]"
          />
          <button
            type="button"
            disabled={
              Boolean(busyId) || !date || !nameVi.trim() || !nameZh.trim()
            }
            onClick={() => void save()}
            className="h-11 rounded-xl bg-[var(--color-brand-primary)] text-sm font-semibold text-white disabled:opacity-50"
          >
            {labels.addCompanyHoliday}
          </button>
        </div>
      </section>

      {holidays.length ? (
        <div className="space-y-2">
          {holidays.map((holiday) => (
            <article
              key={holiday.id}
              className="flex items-center gap-3 rounded-2xl border border-[var(--color-border-soft)] bg-white p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
                  {holiday.name.vi}
                </p>
                <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">
                  {holiday.holiday_date} · {holiday.name.zh}
                </p>
              </div>
              <button
                type="button"
                disabled={Boolean(busyId)}
                aria-label={labels.removeHoliday}
                onClick={() => void remove(holiday.id)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-red-100 text-red-600 disabled:opacity-50"
              >
                <Trash2 size={15} />
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title={labels.noCompanyHolidays}
          hint={labels.noCompanyHolidaysHint}
        />
      )}
    </div>
  );
}
