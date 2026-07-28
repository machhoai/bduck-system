import type { ExternalCountSession } from "@/api/externalCountApi";

export function toExternalCountMillis(value: unknown) {
  if (!value) return 0;
  if (typeof value === "string" || typeof value === "number") {
    return new Date(value).getTime();
  }
  if (value instanceof Date) return value.getTime();
  if (
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().getTime();
  }
  if (typeof value === "object") {
    const timestamp = value as { seconds?: unknown; _seconds?: unknown };
    const seconds =
      typeof timestamp.seconds === "number"
        ? timestamp.seconds
        : typeof timestamp._seconds === "number"
          ? timestamp._seconds
          : null;
    if (seconds !== null) return seconds * 1000;
  }
  return 0;
}

export function getExternalCountExecutionTime(session: ExternalCountSession) {
  return session.action_time || session.submitted_at || session.created_at;
}

export function formatExternalCountDateTime(
  value: unknown,
  lang: "vi" | "zh",
) {
  const milliseconds = toExternalCountMillis(value);
  if (!milliseconds) return { date: "-", time: "-", dateTime: "-" };
  const date = new Date(milliseconds);
  const locale = lang === "zh" ? "zh-CN" : "vi-VN";
  const dateText = new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
  const timeText = new Intl.DateTimeFormat(locale, {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
  return {
    date: dateText,
    time: timeText,
    dateTime: `${timeText} · ${dateText}`,
  };
}

export function formatExternalCountBusinessDate(
  value: string | null | undefined,
  lang: "vi" | "zh",
) {
  if (!value) return "-";
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat(lang === "zh" ? "zh-CN" : "vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function externalCountStatusClass(status: string) {
  if (status === "VERIFIED" || status === "RESOLVED") {
    return "border-[var(--color-success-border)] bg-[var(--color-success-bg)] text-[var(--color-success-text)]";
  }
  if (status === "DISCREPANCY_FOUND") {
    return "border-[var(--color-warning-border)] bg-[var(--color-warning-bg)] text-[var(--color-warning-text)]";
  }
  if (status === "CANCELLED") {
    return "border-[var(--color-error-border)] bg-[var(--color-error-bg)] text-[var(--color-error-text)]";
  }
  return "border-[var(--color-status-pending-border)] bg-[var(--color-status-pending-bg)] text-[var(--color-status-pending-text)]";
}
