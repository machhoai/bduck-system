export function formatMaybeDate(value: unknown, emptyLabel: string) {
  if (!value) return emptyLabel;
  const raw = value as { toDate?: () => Date; seconds?: number; _seconds?: number };
  const date =
    typeof raw.toDate === "function"
      ? raw.toDate()
      : typeof raw.seconds === "number"
        ? new Date(raw.seconds * 1000)
        : typeof raw._seconds === "number"
          ? new Date(raw._seconds * 1000)
          : new Date(value as string);

  if (Number.isNaN(date.getTime())) return emptyLabel;
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  });
}

export function valueOrEmpty(
  value: string | null | undefined,
  emptyLabel: string,
) {
  return value?.trim() || emptyLabel;
}
