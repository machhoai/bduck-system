"use client";

import Link from "next/link";
import { AlertTriangle, CalendarDays, Clock3 } from "lucide-react";

import { useAttendanceContext } from "@/hooks/useAttendance";
import { useTranslation } from "@/lib/i18n";

import { TimeCheckInPanel } from "./TimeCheckInPanel";

const QUICK_CHECK_IN_COPY = {
  vi: {
    title: "Chấm công",
    subtitle: "Sẵn sàng ngay khi mở ứng dụng",
    preparing: "Đang xác minh phiên và chính sách chấm công…",
    unavailable: "Tài khoản hiện không thể chấm công tại nơi làm việc này.",
    retry: "Thử lại",
    details: "Xem bảng công chi tiết",
  },
  zh: {
    title: "考勤",
    subtitle: "打开应用即可快速打卡",
    preparing: "正在验证会话和考勤规则…",
    unavailable: "当前账户无法在此工作地点打卡。",
    retry: "重试",
    details: "查看考勤详情",
  },
} as const;

export function QuickCheckInPage() {
  const { t, lang } = useTranslation();
  const labels = (t as unknown as { attendance: Record<string, string> })
    .attendance;
  const copy = QUICK_CHECK_IN_COPY[lang === "zh" ? "zh" : "vi"];
  const { context, error, reload, checkIn } = useAttendanceContext();

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 pb-4 lg:gap-4">
      <header className="rounded-[28px] border border-white/80 bg-white p-5 shadow-sm lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-soft)] lg:shadow-none">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-brand-primary-muted)] text-[var(--color-brand-primary)]">
            <Clock3 size={23} />
          </div>
          <div className="min-w-0">
            <h1 className="font-[var(--font-display)] text-lg font-bold text-[var(--color-text-primary)]">
              {copy.title}
            </h1>
            <p className="text-sm text-[var(--color-text-secondary)]">
              {copy.subtitle}
            </p>
          </div>
        </div>
      </header>

      {context?.can_check_in ? (
        <TimeCheckInPanel
          context={context}
          labels={labels}
          onCheckIn={checkIn}
        />
      ) : (
        <section className="rounded-[28px] border border-white/80 bg-white p-5 shadow-sm lg:rounded-[var(--radius-lg)] lg:border-[var(--color-border-soft)] lg:shadow-none">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[var(--color-text-muted)]">
              {error ? <AlertTriangle size={19} /> : <Clock3 size={19} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {error ||
                  context?.messages?.[lang] ||
                  (context ? copy.unavailable : copy.preparing)}
              </p>
              {error ? (
                <button
                  type="button"
                  onClick={() => void reload()}
                  className="mt-3 rounded-full bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-white"
                >
                  {copy.retry}
                </button>
              ) : null}
            </div>
          </div>
        </section>
      )}

      <Link
        href="/employee-admin"
        className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-[var(--color-border-subtle)] bg-white px-4 text-sm font-semibold text-[var(--color-text-secondary)] shadow-sm transition-colors hover:bg-slate-50"
      >
        <CalendarDays size={17} />
        {copy.details}
      </Link>
    </div>
  );
}
